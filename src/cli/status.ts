import { CLIError, type Out } from '@kjanat/dreamcli';

import { checkAnthropic } from '#claude-down/lib/anthropic.ts';
import { EXIT_CODES } from '#claude-down/lib/constants.ts';
import { checkDownDetector } from '#claude-down/lib/downdetector.ts';
import type { Indicator } from '#claude-down/lib/types.ts';

const sources = ['anthropic', 'downdetector'] as const;

type Source = (typeof sources)[number];

const sourceLabels = {
	anthropic: 'Anthropic',
	downdetector: 'Downdetector',
} as const satisfies Record<Source, string>;

type AnthropicStatus = Exclude<Indicator, 'unavailable' | 'none'> | 'up';
type DowndetectorStatus = 'up' | 'down';

type IncidentSummary = Readonly<{ name: string; status: string }>;
type AffectedComponent = Readonly<{ name: string; status: string }>;

type AnthropicRow = Readonly<{
	source: 'anthropic';
	status: AnthropicStatus;
	details: string | null;
	incidents: readonly IncidentSummary[] | null;
	affected: readonly AffectedComponent[] | null;
}>;

type DowndetectorRow = Readonly<{
	source: 'downdetector';
	status: DowndetectorStatus;
	details: string | null;
}>;

type StatusRow = AnthropicRow | DowndetectorRow;

type SourceCheck = Readonly<{
	exitCode: number;
	row: StatusRow;
}>;

/**
 * Narrows a raw string to a valid API indicator value.
 *
 * @param value - Raw indicator string from the API response.
 * @returns `true` if `value` is a recognised non-unavailable indicator.
 */
function isApiIndicator(value: string): value is Exclude<Indicator, 'unavailable'> {
	return value === 'none' || value === 'minor' || value === 'major' || value === 'critical';
}

/**
 * Coerces an arbitrary string into a valid indicator, defaulting unrecognised values to `'critical'`.
 *
 * @param value - Raw indicator string.
 * @returns A valid non-unavailable indicator.
 */
function normalizeIndicator(value: string): Exclude<Indicator, 'unavailable'> {
	return isApiIndicator(value) ? value : 'critical';
}

/**
 * Appends an indented labelled list to the output lines buffer. No-ops when `items` is empty.
 *
 * @param lines - Mutable array of output lines to append to.
 * @param label - Section heading shown before the list.
 * @param items - List entries to render as bullet points.
 */
function formatList(lines: string[], label: string, items: readonly string[]): void {
	if (items.length === 0) return;
	lines.push(`  ${label}:`);
	for (const item of items) {
		lines.push(`    - ${item}`);
	}
}

/**
 * Renders a single status row as a human-readable multi-line string.
 *
 * @param row - The status row to format.
 * @returns Formatted string with source name, details, incidents, and affected components.
 */
function formatRow(row: StatusRow): string {
	const lines: string[] = [sourceLabels[row.source]];

	if (row.source === 'downdetector') {
		lines.push(`  ${row.details ?? 'No user-reported issues'}`);
		return lines.join('\n');
	}

	lines.push(`  ${row.details ?? 'All systems operational'}`);

	const incidents = row.incidents?.map((incident) => `${incident.name} (${incident.status})`) ?? [];
	formatList(lines, incidents.length === 1 ? 'Active incident' : 'Active incidents', incidents);
	formatList(lines, 'Affected components', row.affected?.map((component) => component.name) ?? []);

	return lines.join('\n');
}

/**
 * Fetches the current Anthropic status page and maps it to a {@link SourceCheck}.
 *
 * @param anthropicStatusBase - Base URL of the Anthropic status API.
 * @returns Resolved check with exit code and status row.
 * @throws {CLIError} When the Anthropic status page is unreachable (`ANTHROPIC_UNAVAILABLE`).
 */
async function checkAnthropicSource(anthropicStatusBase: string): Promise<SourceCheck> {
	const result = await checkAnthropic(anthropicStatusBase);
	if (result.kind === 'unknown') {
		throw new CLIError(`anthropic unavailable: ${result.reason}`, {
			code: 'ANTHROPIC_UNAVAILABLE',
			exitCode: EXIT_CODES.unavailable,
			details: { anthropic: result.reason },
		});
	}

	const indicator = normalizeIndicator(result.summary.status.indicator);
	const affected = result.summary.components.filter((component) => component.status !== 'operational');

	return {
		exitCode: EXIT_CODES[indicator],
		row: {
			source: 'anthropic',
			status: indicator === 'none' ? 'up' : indicator,
			details: result.summary.status.description,
			incidents: result.summary.incidents.length > 0
				? result.summary.incidents.map((incident) => ({ name: incident.name, status: incident.status }))
				: null,
			affected: affected.length > 0
				? affected.map((component) => ({ name: component.name, status: component.status }))
				: null,
		},
	};
}

/**
 * Scrapes Downdetector for user-reported outage data and maps it to a {@link SourceCheck}.
 *
 * @returns Resolved check with exit code and status row.
 * @throws {CLIError} When Downdetector is unreachable (`DOWNDETECTOR_UNAVAILABLE`).
 */
async function checkDowndetectorSource(): Promise<SourceCheck> {
	const result = await checkDownDetector();
	if (!result.ok) {
		throw new CLIError(`downdetector unavailable: ${result.error}`, {
			code: 'DOWNDETECTOR_UNAVAILABLE',
			exitCode: EXIT_CODES.unavailable,
			details: { downdetector: result.error },
		});
	}

	return {
		exitCode: result.down ? EXIT_CODES.major : EXIT_CODES.none,
		row: {
			source: 'downdetector',
			status: result.down ? 'down' : 'up',
			details: result.down ? result.reason : null,
		},
	};
}

/**
 * Checks all requested sources in parallel via exhaustive dispatch.
 * TypeScript errors if a source is added to the union but not handled here.
 *
 * @param sources - Sources to query.
 * @param anthropicStatusBase - Base URL of the Anthropic status API.
 * @returns Settled check results, one per source.
 * @throws {CLIError} If any individual source check fails.
 */
async function checkSources(
	sources: readonly Source[],
	anthropicStatusBase: string,
): Promise<readonly SourceCheck[]> {
	const check = (source: Source): Promise<SourceCheck> => {
		switch (source) {
			case 'anthropic':
				return checkAnthropicSource(anthropicStatusBase);
			case 'downdetector':
				return checkDowndetectorSource();
		}
	};
	return Promise.all(sources.map(check));
}

/**
 * Derives the worst-case exit code across all source checks.
 *
 * @param results - Completed source checks.
 * @returns The highest (most severe) exit code found.
 */
function summarizeExitCode(results: readonly SourceCheck[]): number {
	return results.reduce<number>((max, current) => Math.max(max, current.exitCode), EXIT_CODES.none);
}

/**
 * Extracts status rows from source checks and sorts them alphabetically by source name.
 *
 * @param results - Completed source checks.
 * @returns Sorted array of status rows.
 */
function sortRows(results: readonly SourceCheck[]): StatusRow[] {
	return results
		.map((result) => result.row)
		.sort((left, right) => left.source.localeCompare(right.source));
}

/**
 * Outputs status rows to the user — as JSON when
 * in JSON/non-TTY mode, or as formatted text otherwise.
 *
 * @param rows - Status rows to render.
 * @param out - Output sink (handles TTY detection and JSON mode).
 */
function renderStatusResult(rows: readonly StatusRow[], out: Out): void {
	if (out.jsonMode || !out.isTTY) {
		out.json(rows);
		return;
	}

	out.log(rows.map((row) => formatRow(row)).join('\n\n'));
}

export {
	checkAnthropicSource,
	checkDowndetectorSource,
	checkSources,
	renderStatusResult,
	sortRows,
	sourceLabels,
	sources,
	summarizeExitCode,
};
export type { Source, SourceCheck, StatusRow };
