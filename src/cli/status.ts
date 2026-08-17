import {
	type Model,
	modelsNamedInText,
	nameMatchesManyModels,
	nameMatchesModels,
} from '#claude-down/cli/model';
import type { Source, StatusRow } from '#claude-down/cli/model';
import { checkAnthropic } from '#claude-down/lib/anthropic';
import { ANTHROPIC_STATUS_BASE, EXIT_CODES } from '#claude-down/lib/constants';
import { checkDownDetector } from '#claude-down/lib/downdetector';
import {
	deriveConservativeIndicator,
	describeIndicator,
	normalizeIncidentImpact,
} from '#claude-down/lib/severity';
import type { ComponentStatus, Summary } from '#claude-down/lib/types';

function normalizeComponentStatus(value: string): ComponentStatus {
	if (
		value === 'operational'
		|| value === 'degraded_performance'
		|| value === 'partial_outage'
		|| value === 'major_outage'
		|| value === 'under_maintenance'
	) {
		return value;
	}

	return 'major_outage';
}

function incidentUrl(id: string, shortlink: unknown): string {
	if (typeof shortlink === 'string' && shortlink.length > 0) return shortlink;

	return new URL(
		`/incidents/${encodeURIComponent(id)}`,
		ANTHROPIC_STATUS_BASE,
	).href;
}

function anthropicSummaryToRow(summary: Summary): StatusRow {
	const reportedIndicator = summary.status.indicator;
	const indicator = deriveConservativeIndicator(
		reportedIndicator,
		summary.components,
	);
	const summaryText = indicator === reportedIndicator
		? summary.status.description
		: `${describeIndicator(indicator)} (reported ${String(reportedIndicator)})`;
	const affectedComponents = summary.components.filter(
		(component) => component.status !== 'operational',
	);

	return {
		source: 'anthropic',
		indicator,
		summaryText,
		incidents: summary.incidents.length > 0
			? summary.incidents.map((incident) => ({
				createdAt: incident.created_at,
				impact: normalizeIncidentImpact(incident.impact),
				name: incident.name,
				status: incident.status,
				updatedAt: incident.updated_at,
				url: incidentUrl(incident.id, incident.shortlink),
			}))
			: null,
		affectedComponents: affectedComponents.length > 0
			? affectedComponents.map((component) => ({
				name: component.name,
				status: normalizeComponentStatus(component.status),
			}))
			: null,
	};
}

async function checkAnthropicSource(
	anthropicStatusBase: string | URL,
): Promise<StatusRow> {
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

	return anthropicSummaryToRow(result.summary);
}

async function checkDowndetectorSource(
	chromePath?: string,
): Promise<StatusRow> {
	const result = await checkDownDetector(chromePath);
	if (!result.ok) {
		return {
			source: 'downdetector',
			indicator: 'unavailable',
			summaryText: result.error,
			reportsOutage: false,
		};
	}

	if (result.down) {
		return {
			source: 'downdetector',
			indicator: 'major',
			summaryText: result.reason,
			reportsOutage: true,
		};
	}

	return {
		source: 'downdetector',
		indicator: result.note !== undefined ? 'minor' : 'none',
		summaryText: result.note ?? null,
		reportsOutage: false,
	};
}

async function checkSource(
	source: Source,
	anthropicStatusBase: string | URL,
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
	anthropicStatusBase: string | URL,
	chromePath?: string,
): Promise<readonly StatusRow[]> {
	return Promise.all(
		sources.map((source) =>
			checkSource(source, anthropicStatusBase, chromePath)
		),
	);
}

function addModelsNamedInItems(
	affectedModels: Set<Model>,
	items: readonly { name: string }[],
	selected: ReadonlySet<Model>,
): boolean {
	let hasBroadModelMatch = false;

	for (const item of items) {
		if (nameMatchesManyModels(item.name)) hasBroadModelMatch = true;
		for (const model of modelsNamedInText(item.name, selected)) {
			affectedModels.add(model);
		}
	}

	return hasBroadModelMatch;
}

function matchedModelNames(
	incidents: readonly { name: string }[],
	affectedComponents: readonly { name: string }[],
	selected: ReadonlySet<Model>,
): Model[] {
	const affectedModels = new Set<Model>();
	const hasBroadModelMatch =
		addModelsNamedInItems(affectedModels, incidents, selected)
		|| addModelsNamedInItems(affectedModels, affectedComponents, selected);

	if (hasBroadModelMatch) {
		for (const model of selected) affectedModels.add(model);
	}

	return [...selected].filter((model) => affectedModels.has(model));
}

/**
 * Narrows an Anthropic row to incidents/components naming the selected models
 * and re-derives its result from those matches (operational when none match).
 * Other rows, unavailable rows, and the empty selection pass through unchanged.
 */
function filterAnthropicByModels(
	row: StatusRow,
	selected: ReadonlySet<Model>,
): StatusRow {
	if (
		row.source !== 'anthropic'
		|| selected.size === 0
		|| row.indicator === 'unavailable'
	) {
		return row;
	}

	const incidents =
		row.incidents?.filter((incident) =>
			nameMatchesModels(incident.name, selected)
		) ?? [];
	const affectedComponents =
		row.affectedComponents?.filter((component) =>
			nameMatchesModels(component.name, selected)
		) ?? [];

	const matchCount = incidents.length + affectedComponents.length;
	// Only name the models that actually appear in a matched incident/component
	// — not every queried model — so `--fable --opus` reports just Fable when
	// Opus is unaffected. Broad incidents like "many models" affect all queried
	// models because the status page gives no narrower model list.
	const affectedModelNames = matchedModelNames(
		incidents,
		affectedComponents,
		selected,
	);

	return {
		source: 'anthropic',
		indicator: matchCount > 0 ? 'major' : 'none',
		summaryText: matchCount > 0
			? `${matchCount} report${matchCount === 1 ? '' : 's'} affecting ${
				affectedModelNames.join(
					', ',
				)
			}`
			: `No incidents reported for ${[...selected].join(', ')}`,
		incidents: incidents.length > 0 ? incidents : null,
		affectedComponents: affectedComponents.length > 0
			? affectedComponents
			: null,
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
	const reachable = rows.filter((row) => row.indicator !== 'unavailable');
	// A source we couldn't reach is "unknown", not "down": its code only counts
	// when every source was unreachable, so a flaky Downdetector scrape doesn't
	// mask an otherwise-operational result.
	if (reachable.length === 0) {
		return rows.length === 0 ? EXIT_CODES.none : EXIT_CODES.unavailable;
	}

	return reachable.reduce<number>(
		(max, row) => Math.max(max, getExitCode(row)),
		EXIT_CODES.none,
	);
}

function sortRows(rows: readonly StatusRow[]): StatusRow[] {
	return [...rows].sort((left, right) =>
		left.source.localeCompare(right.source)
	);
}

export {
	anthropicSummaryToRow,
	checkAnthropicSource,
	checkDowndetectorSource,
	checkSource,
	checkSources,
	filterAnthropicByModels,
	getExitCode,
	sortRows,
	summarizeExitCode,
};
