import { checkAnthropic } from '#claude-down/lib/anthropic.ts';
import { EXIT_CODES } from '#claude-down/lib/constants.ts';
import { checkDownDetector } from '#claude-down/lib/downdetector.ts';

const claudeDown = { checkAnthropic, checkDownDetector, EXIT_CODES };

export { checkAnthropic, checkDownDetector, claudeDown as default, EXIT_CODES };
export type {
	AvailableIndicator,
	ComponentStatus,
	IncidentImpactValue,
	IncidentStatusValue,
	Indicator,
	Result,
	Signal,
	Summary,
} from '#claude-down/lib/types.ts';
export type { Component, Incident } from 'statuspage.io';
