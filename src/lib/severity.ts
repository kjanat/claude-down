import type { IncidentImpactValue } from '#claude-down/lib/types';

const INDICATOR_RANKS = {
	none: 0,
	minor: 1,
	major: 2,
	critical: 3,
} as const satisfies Record<IncidentImpactValue, number>;

const INDICATOR_DESCRIPTIONS = {
	none: 'All Systems Operational',
	minor: 'Minor Service Outage',
	major: 'Major Service Outage',
	critical: 'Critical Service Outage',
} as const satisfies Record<IncidentImpactValue, string>;

function isIncidentImpact(value: unknown): value is IncidentImpactValue {
	return typeof value === 'string' && value in INDICATOR_RANKS;
}

function normalizeIncidentImpact(value: unknown): IncidentImpactValue {
	return isIncidentImpact(value) ? value : 'critical';
}

function higherImpact(
	left: IncidentImpactValue,
	right: IncidentImpactValue,
): IncidentImpactValue {
	return INDICATOR_RANKS[right] > INDICATOR_RANKS[left] ? right : left;
}

function componentStatusImpact(status: unknown): IncidentImpactValue {
	switch (status) {
		case 'operational':
			return 'none';
		case 'degraded_performance':
		case 'under_maintenance':
			return 'minor';
		case 'partial_outage':
		case 'major_outage':
			return 'major';
		default:
			return 'major';
	}
}

function deriveConservativeIndicator(
	reportedIndicator: unknown,
	incidents: readonly { impact: unknown }[] = [],
	components: readonly { status: unknown }[] = [],
): IncidentImpactValue {
	let indicator = normalizeIncidentImpact(reportedIndicator);

	for (const incident of incidents) {
		indicator = higherImpact(
			indicator,
			normalizeIncidentImpact(incident.impact),
		);
	}

	for (const component of components) {
		indicator = higherImpact(
			indicator,
			componentStatusImpact(component.status),
		);
	}

	return indicator;
}

function describeIndicator(indicator: IncidentImpactValue): string {
	return INDICATOR_DESCRIPTIONS[indicator];
}

export {
	componentStatusImpact,
	deriveConservativeIndicator,
	describeIndicator,
	isIncidentImpact,
	normalizeIncidentImpact,
};
