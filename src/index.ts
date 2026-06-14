import { checkAnthropic } from '#claude-down/lib/anthropic';
import { EXIT_CODES } from '#claude-down/lib/constants';
import { checkDownDetector } from '#claude-down/lib/downdetector';

const claudeDown = { checkAnthropic, checkDownDetector, EXIT_CODES };

export default claudeDown;
export { checkAnthropic, checkDownDetector, EXIT_CODES };

export type {
	ComponentStatus,
	IncidentImpactValue,
	IncidentStatusValue,
	Indicator,
	Result,
	Signal,
} from '#claude-down/lib/types';

export type { Component, Incident, Summary } from 'statuspage.io';
