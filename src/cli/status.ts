import { type Model, nameMatchesModels } from '#claude-down/cli/model.ts';
import type { Source, StatusRow } from '#claude-down/cli/model.ts';
import { checkAnthropic } from '#claude-down/lib/anthropic.ts';
import { EXIT_CODES } from '#claude-down/lib/constants.ts';
import { checkDownDetector } from '#claude-down/lib/downdetector.ts';
import type { AvailableIndicator } from '#claude-down/lib/types.ts';

function normalizeIndicator(value: string): AvailableIndicator {
	if (value === 'none' || value === 'minor' || value === 'major' || value === 'critical') {
		return value;
	}

	return 'critical';
}

async function checkAnthropicSource(anthropicStatusBase: string): Promise<StatusRow> {
	const result = await checkAnthropic(anthropicStatusBase);
	if (result.kind === 'unknown') {
		return {
			source: 'anthropic',
			indicator: 'unavailable',
			summaryText: result.reason,
			incidents: null,
			affectedComponents: null,
		};
	}

	const indicator = normalizeIndicator(result.summary.status.indicator);
	const affectedComponents = result.summary.components.filter(
		(component) => component.status !== 'operational',
	);

	return {
		source: 'anthropic',
		indicator,
		summaryText: result.summary.status.description,
		incidents: result.summary.incidents.length > 0
			? result.summary.incidents.map((incident) => ({ name: incident.name, status: incident.status }))
			: null,
		affectedComponents: affectedComponents.length > 0
			? affectedComponents.map((component) => ({ name: component.name, status: component.status }))
			: null,
	};
}

async function checkDowndetectorSource(chromePath?: string): Promise<StatusRow> {
	const result = await checkDownDetector(chromePath);
	if (!result.ok) {
		return {
			source: 'downdetector',
			indicator: 'unavailable',
			summaryText: result.error,
			reportsOutage: false,
		};
	}

	return {
		source: 'downdetector',
		indicator: result.down ? 'major' : 'none',
		summaryText: result.down ? result.reason : null,
		reportsOutage: result.down,
	};
}

async function checkSource(
	source: Source,
	anthropicStatusBase: string,
	chromePath?: string,
): Promise<StatusRow> {
	switch (source) {
		case 'anthropic':
			return checkAnthropicSource(anthropicStatusBase);
		case 'downdetector':
			return checkDowndetectorSource(chromePath);
	}
}

async function checkSources(
	sources: readonly Source[],
	anthropicStatusBase: string,
	chromePath?: string,
): Promise<readonly StatusRow[]> {
	return Promise.all(sources.map((source) => checkSource(source, anthropicStatusBase, chromePath)));
}

/**
 * Narrows an Anthropic row to incidents/components naming the selected models
 * and re-derives its result from those matches (operational when none match).
 * Other rows, unavailable rows, and the empty selection pass through unchanged.
 */
function filterAnthropicByModels(row: StatusRow, selected: ReadonlySet<Model>): StatusRow {
	if (row.source !== 'anthropic' || selected.size === 0 || row.indicator === 'unavailable') {
		return row;
	}

	const incidents = row.incidents?.filter((incident) => nameMatchesModels(incident.name, selected)) ?? [];
	const affectedComponents = row.affectedComponents?.filter((component) => nameMatchesModels(component.name, selected))
		?? [];

	const label = [...selected].join(', ');
	const matchCount = incidents.length + affectedComponents.length;

	return {
		source: 'anthropic',
		indicator: matchCount > 0 ? 'major' : 'none',
		summaryText: matchCount > 0
			? `${matchCount} report(s) affecting ${label}`
			: `No incidents reported for ${label}`,
		incidents: incidents.length > 0 ? incidents : null,
		affectedComponents: affectedComponents.length > 0 ? affectedComponents : null,
	};
}

function getExitCode(row: StatusRow): number {
	const code = EXIT_CODES[row.indicator];
	// An active incident is a failure even when the page indicator reads operational.
	if (row.source === 'anthropic' && row.incidents && row.incidents.length > 0) {
		return Math.max(code, EXIT_CODES.minor);
	}

	return code;
}

function summarizeExitCode(rows: readonly StatusRow[]): number {
	return rows.reduce<number>((max, row) => Math.max(max, getExitCode(row)), EXIT_CODES.none);
}

function sortRows(rows: readonly StatusRow[]): StatusRow[] {
	return [...rows].sort((left, right) => left.source.localeCompare(right.source));
}

export {
	checkAnthropicSource,
	checkDowndetectorSource,
	checkSource,
	checkSources,
	filterAnthropicByModels,
	getExitCode,
	sortRows,
	summarizeExitCode,
};
