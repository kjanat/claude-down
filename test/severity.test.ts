import { describe, expect, test } from 'bun:test';

import {
	componentStatusImpact,
	deriveConservativeIndicator,
	describeIndicator,
} from '#claude-down/lib/severity';

describe(deriveConservativeIndicator.name, () => {
	test('promotes a minor page indicator when an incident is major', () => {
		expect(
			deriveConservativeIndicator(
				'minor',
				[{ impact: 'major' }],
				[],
			),
		).toBe('major');
	});

	test('promotes an operational page indicator when a component is out', () => {
		expect(
			deriveConservativeIndicator(
				'none',
				[],
				[{ status: 'partial_outage' }],
			),
		).toBe('major');
	});

	test('keeps the highest reported indicator', () => {
		expect(
			deriveConservativeIndicator(
				'critical',
				[{ impact: 'minor' }],
				[{ status: 'operational' }],
			),
		).toBe('critical');
	});
});

describe(componentStatusImpact.name, () => {
	test('maps degraded service to minor and outage states to major', () => {
		expect(componentStatusImpact('degraded_performance')).toBe('minor');
		expect(componentStatusImpact('partial_outage')).toBe('major');
		expect(componentStatusImpact('major_outage')).toBe('major');
	});
});

describe(describeIndicator.name, () => {
	test('returns display copy for promoted indicators', () => {
		expect(describeIndicator('major')).toBe('Major Service Outage');
	});
});
