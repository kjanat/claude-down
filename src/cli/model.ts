import type {
	ComponentStatus,
	IncidentStatusValue,
	Indicator,
} from '#claude-down/lib/types';

const sources = ['anthropic', 'downdetector'] as const;

type Source = (typeof sources)[number];

const sourceLabels = {
	anthropic: 'Anthropic',
	downdetector: 'Downdetector',
} as const satisfies Record<Source, string>;

/** Model families that incident/component names can be filtered against. */
const models = ['opus', 'haiku', 'sonnet', 'mythos', 'fable'] as const;

type Model = (typeof models)[number];

const broadModelMessagePattern =
	/\b(?:all|many|most|multiple|several|some|various)\s+(?:claude\s+)?models?\b/;

/** Case-insensitive check for broad incidents like "many models". */
function nameMatchesManyModels(name: string): boolean {
	return broadModelMessagePattern.test(name.toLowerCase());
}

/** Case-insensitive list of selected models directly named in text. */
function modelsNamedInText(
	name: string,
	selected: ReadonlySet<Model>,
): Model[] {
	const lower = name.toLowerCase();
	const matched: Model[] = [];

	for (const model of selected) {
		if (lower.includes(model)) matched.push(model);
	}

	return matched;
}

/** Case-insensitive check for whether a name mentions selected models. */
function nameMatchesModels(
	name: string,
	selected: ReadonlySet<Model>,
): boolean {
	return (
		selected.size > 0
		&& (modelsNamedInText(name, selected).length > 0
			|| nameMatchesManyModels(name))
	);
}

type IncidentSummary = Readonly<{
	name: string;
	status: IncidentStatusValue;
}>;

type AffectedComponent = Readonly<{
	name: string;
	status: ComponentStatus;
}>;

type AnthropicStatusRow = Readonly<{
	source: 'anthropic';
	indicator: Indicator;
	summaryText: string | null;
	incidents: readonly IncidentSummary[] | null;
	affectedComponents: readonly AffectedComponent[] | null;
}>;

type DowndetectorStatusRow = Readonly<{
	source: 'downdetector';
	indicator: Extract<Indicator, 'none' | 'minor' | 'major' | 'unavailable'>;
	summaryText: string | null;
	reportsOutage: boolean;
}>;

type StatusRow = AnthropicStatusRow | DowndetectorStatusRow;

type AnthropicOutputStatus = Exclude<Indicator, 'none'> | 'up';
type DowndetectorOutputStatus = 'up' | 'down' | 'unavailable';

type AnthropicOutputRow = Readonly<{
	source: 'anthropic';
	status: AnthropicOutputStatus;
	details: string | null;
	incidents: readonly IncidentSummary[] | null;
	affected: readonly AffectedComponent[] | null;
}>;

type DowndetectorOutputRow = Readonly<{
	source: 'downdetector';
	status: DowndetectorOutputStatus;
	details: string | null;
}>;

type StatusOutputRow = AnthropicOutputRow | DowndetectorOutputRow;

export {
	models,
	modelsNamedInText,
	nameMatchesManyModels,
	nameMatchesModels,
	sourceLabels,
	sources,
};
export type {
	AnthropicStatusRow,
	DowndetectorStatusRow,
	Model,
	Source,
	StatusOutputRow,
	StatusRow,
};
