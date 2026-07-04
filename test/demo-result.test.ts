import { describe, expect, test } from 'bun:test';

import {
	getResultErrorMessage,
	getResultHeaders,
	isFailureResult,
	normalizeSummary,
} from '#demo/result';

describe(getResultErrorMessage.name, () => {
	test('reads useful error messages from common result shapes', () => {
		expect(getResultErrorMessage(new Error('exploded'))).toBe('exploded');
		expect(getResultErrorMessage('plain')).toBe('plain');
		expect(getResultErrorMessage({ reason: new Error('reason') })).toBe(
			'reason',
		);
		expect(getResultErrorMessage({ error: 'bad gateway' })).toBe('bad gateway');
		expect(getResultErrorMessage({ message: 'failed' })).toBe('failed');
		expect(getResultErrorMessage({})).toBe('Unknown error');
	});
});

describe(getResultHeaders.name, () => {
	test('returns Headers only when present', () => {
		const headers = new Headers({ 'cache-control': 'max-age=60' });

		expect(getResultHeaders(null)).toBeUndefined();
		expect(getResultHeaders({ headers: null })).toBeUndefined();
		expect(getResultHeaders({ headers })).toBe(headers);
	});
});

describe(isFailureResult.name, () => {
	test('understands supported success discriminants', () => {
		expect(isFailureResult(null)).toBe(false);
		expect(isFailureResult({ kind: 'ok' })).toBe(false);
		expect(isFailureResult({ kind: 'unknown' })).toBe(true);
		expect(isFailureResult({ ok: true })).toBe(false);
		expect(isFailureResult({ ok: false })).toBe(true);
		expect(isFailureResult({ success: true })).toBe(false);
		expect(isFailureResult({ success: false })).toBe(true);
		expect(isFailureResult({})).toBe(false);
	});
});

describe(normalizeSummary.name, () => {
	test('does not promote the hero indicator on incident impact alone', () => {
		// A `major` incident that affects no component (e.g. a deliberate model
		// suspension) must not drag the headline above the operational state.
		const summary = normalizeSummary({
			status: {
				description: 'All Systems Operational',
				indicator: 'none',
			},
			incidents: [
				{
					created_at: '2026-06-13T00:00:00.000Z',
					impact: 'major',
					name: 'We’ve suspended access to Claude Mythos 5 and Claude Fable 5',
					status: 'investigating',
					updated_at: '2026-06-16T00:00:00.000Z',
				},
			],
			components: [
				{ name: 'claude.ai', status: 'operational' },
				{ name: 'Claude API', status: 'operational' },
			],
		});

		expect(summary.status).toEqual({
			description: 'All Systems Operational',
			indicator: 'none',
			reportedIndicator: 'none',
		});
	});

	test('promotes the hero indicator from affected component state', () => {
		const summary = normalizeSummary({
			status: {
				description: 'Minor Service Outage',
				indicator: 'minor',
			},
			incidents: [
				{
					created_at: '2026-06-22T00:00:00.000Z',
					impact: 'major',
					name: 'Elevated error rates',
					status: 'investigating',
					updated_at: '2026-06-22T00:00:00.000Z',
				},
			],
			components: [{ name: 'Claude API', status: 'partial_outage' }],
		});

		expect(summary.status).toEqual({
			description: 'Major Service Outage',
			indicator: 'major',
			reportedIndicator: 'minor',
		});
	});

	test('drops malformed incident and component entries', () => {
		const summary = normalizeSummary({
			status: {
				description: 'All Systems Operational',
				indicator: 'none',
			},
			incidents: [
				null,
				'bad',
				{ impact: 'critical' },
				{
					created_at: '2026-06-22T00:00:00.000Z',
					impact: 'minor',
					name: 'Latency',
					status: 'monitoring',
					updated_at: '2026-06-22T00:00:00.000Z',
				},
			],
			components: [
				null,
				'bad',
				{ status: 'major_outage' },
				{ name: 'Claude API', status: 'partial_outage' },
			],
		});

		expect(summary.incidents.map((incident) => incident.name)).toEqual([
			'Latency',
		]);
		expect(summary.components.map((component) => component.name)).toEqual([
			'Claude API',
		]);
		expect(summary.status.indicator).toBe('major');
	});

	test('accepts wrapped payloads and string hero statuses', () => {
		expect(
			normalizeSummary({
				summary: {
					status: 'operational',
					incidents: 'not an array',
					components: 'not an array',
				},
			}),
		).toEqual({
			status: {
				description: 'operational',
				indicator: 'none',
				reportedIndicator: 'none',
			},
			incidents: [],
			components: [],
		});

		expect(
			normalizeSummary({
				data: {
					status: { indicator: 'minor' },
					incidents: [],
					components: [],
				},
			}).status.description,
		).toBe('Indicator: minor');
	});

	test('falls back through alternate payload wrappers', () => {
		expect(
			normalizeSummary({
				value: {
					status: { description: 'All Systems Operational' },
				},
			}).status,
		).toEqual({
			description: 'All Systems Operational',
			indicator: 'none',
			reportedIndicator: 'none',
		});

		expect(
			normalizeSummary({
				result: {
					status: undefined,
				},
			}).status,
		).toEqual({
			description: 'Unknown status',
			indicator: 'major',
			reportedIndicator: 'major',
		});
	});

	test('rejects invalid payloads', () => {
		expect(() => normalizeSummary(null)).toThrow('Invalid status response');
	});
});
