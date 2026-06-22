import { describe, expect, test } from 'bun:test';

import {
	componentStatusImpact,
	deriveConservativeIndicator,
	describeIndicator,
} from '#claude-down/lib/severity';

describe(deriveConservativeIndicator.name, () => {
	test('promotes an operational page indicator when a component is out', () => {
		expect(
			deriveConservativeIndicator(
				'none',
				[{ status: 'partial_outage' }],
			),
		).toBe('major');
	});

	test('promotes a minor page indicator when components are in partial outage', () => {
		expect(
			deriveConservativeIndicator(
				'minor',
				[{ status: 'partial_outage' }, { status: 'operational' }],
			),
		).toBe('major');
	});

	test('does not promote on incident impact alone when all components are operational', () => {
		// A model suspension is labelled `major` but takes nothing offline:
		// the headline must stay operational.
		expect(
			deriveConservativeIndicator(
				'none',
				[
					{ status: 'operational' },
					{ status: 'operational' },
					{ status: 'operational' },
				],
			),
		).toBe('none');
	});

	test('keeps the highest reported indicator', () => {
		expect(
			deriveConservativeIndicator(
				'critical',
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
