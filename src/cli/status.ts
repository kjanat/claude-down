import type { Out } from '@kjanat/dreamcli';

import { checkAnthropic, checkDownDetector, EXIT_CODES, toCLIError } from '#claude-down';
import { env, exit } from 'node:process';

import type { Source } from './flags.ts';

const sourceLabels = {
	anthropic: 'Anthropic',
	downdetector: 'Downdetector',
} as const satisfies Record<Source, string>;

type Indicator = keyof typeof EXIT_CODES;
type AnthropicStatus = 'up' | 'minor' | 'major' | 'critical';
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

function isApiIndicator(value: string): value is Exclude<Indicator, 'unavailable'> {
	return value === 'none' || value === 'minor' || value === 'major' || value === 'critical';
}

function normalizeIndicator(value: string): Exclude<Indicator, 'unavailable'> {
	return isApiIndicator(value) ? value : 'critical';
}

function formatList(lines: string[], label: string, items: readonly string[]): void {
	if (items.length === 0) return;

	lines.push(`  ${label}:`);
	for (const item of items) {
		lines.push(`    - ${item}`);
	}
}

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

function getAnthropicStatusBase(): string | undefined {
	const baseUrl = env.CLAUDE_DOWN_ANTHROPIC_STATUS_BASE;
	return baseUrl !== undefined && baseUrl.length > 0 ? baseUrl : undefined;
}

async function checkAnthropicSource(): Promise<SourceCheck> {
	const result = await checkAnthropic(getAnthropicStatusBase());
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

async function checkSource(source: Source): Promise<SourceCheck> {
	switch (source) {
		case 'anthropic':
			return checkAnthropicSource();
		case 'downdetector':
			return checkDowndetectorSource();
	}
}

async function checkSources(sources: readonly Source[]): Promise<readonly SourceCheck[]> {
	return Promise.all(sources.map((source) => checkSource(source)));
}

function summarizeExitCode(results: readonly SourceCheck[]): number {
	return results.reduce<number>((max, current) => Math.max(max, current.exitCode), EXIT_CODES.none);
}

function sortRows(results: readonly SourceCheck[]): StatusRow[] {
	return results
		.map((result) => result.row)
		.sort((left, right) => left.source.localeCompare(right.source));
}

function formatRows(rows: readonly StatusRow[]): string {
	return rows.map((row) => formatRow(row)).join('\n\n');
}

function renderStatusResult(result: number | readonly StatusRow[], out: Out): void {
	if (typeof result === 'number') {
		exit(result);
	}

	if (out.jsonMode || !out.isTTY) {
		out.json(result);
		return;
	}

	out.log(formatRows(result));
}

export { checkSource, checkSources, renderStatusResult, sortRows, sourceLabels, summarizeExitCode };
export type { SourceCheck, StatusRow };
