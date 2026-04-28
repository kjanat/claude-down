import type { Out } from '@kjanat/dreamcli';

import type { Source } from '#claude-down/cli/flags.ts';
import { checkAnthropic } from '#claude-down/lib/anthropic.ts';
import { EXIT_CODES } from '#claude-down/lib/constants.ts';
import { checkDownDetector } from '#claude-down/lib/downdetector.ts';
import { toCLIError } from '#claude-down/lib/errors.ts';

/** Mapping of sources to their display labels for output formatting. */
const sourceLabels = {
	anthropic: 'Anthropic',
	downdetector: 'Downdetector',
} as const satisfies Record<Source, string>;

// "none" | "minor" | "major" | "critical" | "unavailable"
type Indicator = keyof typeof EXIT_CODES;
// "minor" | "major" | "critical" | "up"
type AnthropicStatus = Exclude<Indicator, 'unavailable' | 'none'> | 'up';
type DowndetectorStatus = 'up' | 'down';

type IncidentSummary = Readonly<{
	name: string;
	status: string;
}>;

type AffectedComponent = Readonly<{
	name: string;
	status: string;
}>;

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

type CheckOptions = Readonly<{
	anthropicStatusBase: string | undefined;
}>;

const defaultCheckOptions: CheckOptions = {
	anthropicStatusBase: undefined,
};

function isApiIndicator(value: string): value is Exclude<Indicator, 'unavailable'> {
	return value === 'none' || value === 'minor' || value === 'major' || value === 'critical';
}

/**
 * Normalizes the status indicator from the API to a valid Indicator value.
 *
 * This function checks if the provided value is a valid API indicator. If it is, it returns the value as is. If not, it defaults to 'critical', indicating a severe issue.
 *
 * @param value - The status indicator value to normalize.
 * @returns A valid Indicator value, defaulting to 'critical' if the input is not recognized.
 */
function normalizeIndicator(value: string): Exclude<Indicator, 'unavailable'> {
	return isApiIndicator(value) ? value : 'critical';
}

/**
 * Helper function to format a list of items under a label in the status output.
 *
 * This function takes an array of lines, a label, and a list of items. If the list of items is not empty, it appends the label and each item (prefixed with a dash) to the lines array with appropriate indentation.
 *
 * @param lines - The array of lines to append to.
 * @param label - The label for the list (e.g., "Active incidents" or "Affected components").
 * @param items - The list of items to format under the label.
 */
function formatList(lines: string[], label: string, items: readonly string[]): void {
	if (items.length === 0) return;

	lines.push(`  ${label}:`);
	for (const item of items) {
		lines.push(`    - ${item}`);
	}
}

/**
 * Formats a status row into a human-readable string.
 *
 * This function takes a `StatusRow` object and constructs a formatted string representation of the status, including the source label, status details, active incidents, and affected components if applicable.
 *
 * @param row - The status row to format.
 * @returns A formatted string representing the status row.
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
 * Checks the status of Anthropic's services using their status page API.
 *
 * This function calls the `checkAnthropic` function to retrieve the current status of Anthropic's services.
 *
 * If the check fails, it throws a CLI error with details about the failure.
 *
 * If the check succeeds, it returns a `SourceCheck` object containing the appropriate exit code and a status row indicating the status of Anthropic's services, along with any relevant details such as active incidents and affected components.
 *
 * @param options - Configuration for the check, such as a custom API base URL for Anthropic's status page.
 * @returns A promise that resolves to a `SourceCheck` object with the exit code and status row for Anthropic.
 * @throws A CLI error if the Anthropic check fails, including details about the failure.
 */
async function checkAnthropicSource(options: CheckOptions): Promise<SourceCheck> {
	const result = await checkAnthropic(options.anthropicStatusBase);
	if (result.kind === 'unknown') {
		throw toCLIError({
			code: 'ANTHROPIC_UNAVAILABLE',
			message: `anthropic unavailable: ${result.reason}`,
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
 * Checks the status of Downdetector's reports for Claude AI.
 *
 * This function calls the `checkDownDetector` function to retrieve the current
 * status of Claude AI on Downdetector.
 *
 * If the check fails, it throws a CLI error with details about the failure.
 *
 * If the check succeeds, it returns a `SourceCheck` object containing the
 * appropriate exit code and a status row indicating whether Downdetector
 * reports Claude AI as "up" or "down", along with any relevant details.
 *
 * @returns A promise that resolves to a `SourceCheck` object with the exit code and status row for Downdetector.
 * @throws A CLI error if the Downdetector check fails, including details about the failure.
 */
async function checkDowndetectorSource(): Promise<SourceCheck> {
	const result = await checkDownDetector();
	if (!result.ok) {
		throw toCLIError({
			code: 'DOWNDETECTOR_UNAVAILABLE',
			message: `downdetector unavailable: ${result.error}`,
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
 * Checks the status of a single source.
 *
 * This function takes a source and optional check options, performs the appropriate status check based on the source, and returns a `SourceCheck` object containing the exit code and status row for that source.
 *
 * @param source - The source to check (e.g., 'anthropic' or 'downdetector').
 * @param options - Optional configuration for the checks, such as custom API base URLs.
 * @returns A promise that resolves to a `SourceCheck` object with the exit code and status row for the specified source.
 */
async function checkSource(
	source: Source,
	options: CheckOptions = defaultCheckOptions,
): Promise<SourceCheck> {
	switch (source) {
		case 'anthropic':
			return checkAnthropicSource(options);
		case 'downdetector':
			return checkDowndetectorSource();
	}
}

/**
 * Checks the status of multiple sources concurrently.
 *
 * This function takes an array of sources and performs status checks on each source in parallel using `Promise.all`. It returns an array of `SourceCheck` results corresponding to each source.
 *
 * @param sources - An array of sources to check.
 * @param options - Optional configuration for the checks, such as custom API base URLs.
 * @returns A promise that resolves to an array of `SourceCheck` results for the provided sources.
 */
async function checkSources(
	sources: readonly Source[],
	options: CheckOptions = defaultCheckOptions,
): Promise<readonly SourceCheck[]> {
	return Promise.all(sources.map((source) => checkSource(source, options)));
}

/**
 * Summarizes the exit code from an array of source checks.
 *
 * This function iterates through the results and returns the maximum exit code found, which represents the most severe status among the sources.
 *
 * @param results - An array of source checks to summarize.
 * @returns The maximum exit code from the source checks.
 */
function summarizeExitCode(results: readonly SourceCheck[]): number {
	return results.reduce<number>((max, current) => Math.max(max, current.exitCode), EXIT_CODES.none);
}

/**
 * Sorts an array of source checks by their source name.
 *
 * This function extracts the status rows from the source checks and sorts them alphabetically by their source label.
 *
 * @param results - An array of source checks to sort.
 * @returns A sorted array of status rows.
 */
function sortRows(results: readonly SourceCheck[]): StatusRow[] {
	return results
		.map((result) => result.row)
		.sort((left, right) => left.source.localeCompare(right.source));
}

/**
 * Formats an array of status rows into a human-readable string.
 *
 * Each row is formatted using the `formatRow` function, and rows are separated by two newlines for readability.
 *
 * @param rows - An array of status rows to format.
 * @returns A formatted string representing the status rows.
 */
function formatRows(rows: readonly StatusRow[]): string {
	return rows.map((row) => formatRow(row)).join('\n\n');
}

/**
 * Renders status rows to the output, either as JSON or formatted text.
 *
 * If the output is in JSON mode or not a TTY, it emits the rows as JSON.
 * Otherwise, it formats the rows for human-readable output.
 *
 * @param rows - The status rows to render.
 * @param out - The output interface to write to.
 */
function renderStatusResult(rows: readonly StatusRow[], out: Out): void {
	if (out.jsonMode || !out.isTTY) {
		out.json(rows);
		return;
	}

	out.log(formatRows(rows));
}

export { checkSource, checkSources, renderStatusResult, sortRows, sourceLabels, summarizeExitCode };
export type { SourceCheck, StatusRow };
