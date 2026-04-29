import type { AvailableIndicator } from '#claude-down/lib/types.ts';

const sources = ['anthropic', 'downdetector'] as const;

type Source = (typeof sources)[number];

const sourceLabels = {
	anthropic: 'Anthropic',
	downdetector: 'Downdetector',
} as const satisfies Record<Source, string>;

type IncidentSummary = Readonly<{
	name: string;
	status: string;
}>;

type AffectedComponent = Readonly<{
	name: string;
	status: string;
}>;

type AnthropicStatusRow = Readonly<{
	source: 'anthropic';
	indicator: AvailableIndicator;
	summaryText: string | null;
	incidents: readonly IncidentSummary[] | null;
	affectedComponents: readonly AffectedComponent[] | null;
}>;

type DowndetectorStatusRow = Readonly<{
	source: 'downdetector';
	indicator: 'none' | 'major';
	summaryText: string | null;
	reportsOutage: boolean;
}>;

type StatusRow = AnthropicStatusRow | DowndetectorStatusRow;

type AnthropicOutputStatus = Exclude<AvailableIndicator, 'none'> | 'up';
type DowndetectorOutputStatus = 'up' | 'down';

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

export { sourceLabels, sources };
export type { AnthropicStatusRow, DowndetectorStatusRow, Source, StatusOutputRow, StatusRow };
