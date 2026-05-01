import { checkAnthropic } from '#claude-down/lib/anthropic.ts';

const claudeDown = { checkAnthropic };

export { checkAnthropic, claudeDown as default };
export type {
	AvailableIndicator,
	ComponentStatus,
	IncidentImpactValue,
	IncidentStatusValue,
	Result,
	Summary,
} from '#claude-down/lib/types.ts';
export type { Component, Incident } from 'statuspage.io';
