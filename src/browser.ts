/** biome-ignore-all lint/performance/noBarrelFile: barrel */
import { checkAnthropic } from '#claude-down/lib/anthropic.ts';

export default { checkAnthropic };

export { checkAnthropic } from '#claude-down/lib/anthropic.ts';
export type {
	AvailableIndicator,
	ComponentStatus,
	IncidentImpactValue,
	IncidentStatusValue,
	Result,
	Summary,
} from '#claude-down/lib/types.ts';
export type { Component, Incident } from 'statuspage.io';
