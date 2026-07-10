import { describe, expect, test } from 'bun:test';

import {
	checkAnthropicSource,
	summarizeExitCode,
} from '#claude-down/cli/status';
import { checkAnthropic } from '#claude-down/lib/anthropic';
import {
	cacheControlHeader,
	withSummaryBody,
	withSummaryFixture,
} from '#test/support/statuspage-fixture.ts';

describe('checkAnthropic', () => {
	test('parses the down fixture summary', async () => {
		await withSummaryFixture('anthropic-down.json', async (server) => {
			const result = await checkAnthropic(server.baseUrl);

			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') {
				throw new Error(`expected ok result, got ${result.kind}`);
			}

			expect(result.summary.status.indicator).toBe('major');
			expect(result.summary.status.description).toBe('Partial System Outage');
			expect(result.summary.incidents[0]?.name).toBe(
				'Claude.ai unavailable and elevated errors on the API',
			);
			expect(
				result.summary.components
					.filter((component) => component.status !== 'operational')
					.map((component) => component.name),
			).toEqual([
				'claude.ai',
				'Claude API (api.anthropic.com)',
				'Claude Code',
				'Claude Cowork',
			]);
			expect(server.requests).toEqual(['/api/v2/summary.json']);
		});
	});

	test('degrades to unknown when a 200 response has the wrong shape', async () => {
		await withSummaryBody({ hello: 'world' }, async (server) => {
			const result = await checkAnthropic(server.baseUrl);

			expect(result).toMatchObject({
				kind: 'unknown',
				reason: 'unexpected response shape from status API',
			});
		});
	});

	test('rejects incomplete summaries whose fields the row mapping reads', async () => {
		const bodies = [
			// status missing indicator/description
			{ status: {}, components: [], incidents: [] },
			// incident missing impact
			{
				status: { description: 'ok', indicator: 'none' },
				components: [],
				incidents: [{ name: 'x', status: 'investigating' }],
			},
		];

		for (const body of bodies) {
			await withSummaryBody(body, async (server) => {
				const result = await checkAnthropic(server.baseUrl);

				expect(result).toMatchObject({
					kind: 'unknown',
					reason: 'unexpected response shape from status API',
				});
			});
		}
	});

	test('parses the up fixture summary', async () => {
		await withSummaryFixture('anthropic-up.json', async (server) => {
			const result = await checkAnthropic(server.baseUrl);

			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') {
				throw new Error(`expected ok result, got ${result.kind}`);
			}

			expect(result.summary.status.indicator).toBe('none');
			expect(result.headers.get('cache-control')).toBe(cacheControlHeader);
			expect(result.summary.status.description).toBe('All Systems Operational');
			expect(result.summary.incidents).toEqual([]);
			expect(
				result.summary.components
					.filter((component) => component.status !== 'operational')
					.map((component) => component.name),
			).toEqual([]);
			expect(server.requests).toEqual(['/api/v2/summary.json']);
		});
	});
});

describe('checkAnthropicSource', () => {
	test('maps the down fixture to the internal row model', async () => {
		await withSummaryFixture('anthropic-down.json', async (server) => {
			const row = await checkAnthropicSource(server.baseUrl);

			expect(row).toEqual({
				source: 'anthropic',
				indicator: 'major',
				summaryText: 'Partial System Outage',
				incidents: [
					{
						name: 'Claude.ai unavailable and elevated errors on the API',
						status: 'identified',
					},
				],
				affectedComponents: [
					{ name: 'claude.ai', status: 'major_outage' },
					{ name: 'Claude API (api.anthropic.com)', status: 'partial_outage' },
					{ name: 'Claude Code', status: 'partial_outage' },
					{ name: 'Claude Cowork', status: 'major_outage' },
				],
			});
			expect(server.requests).toEqual(['/api/v2/summary.json']);
		});
	});

	test('maps the up fixture to the internal row model', async () => {
		await withSummaryFixture('anthropic-up.json', async (server) => {
			const row = await checkAnthropicSource(server.baseUrl);

			expect(row).toEqual({
				source: 'anthropic',
				indicator: 'none',
				summaryText: 'All Systems Operational',
				incidents: null,
				affectedComponents: null,
			});
			expect(server.requests).toEqual(['/api/v2/summary.json']);
		});
	});

	test('keeps summary text aligned with promoted severity', async () => {
		await withSummaryBody(
			{
				page: {
					id: 'page',
					name: 'Claude',
					time_zone: 'Etc/UTC',
					updated_at: '2026-06-22T00:00:00.000Z',
					url: 'https://status.claude.com',
				},
				components: [
					{
						name: 'Claude API (api.anthropic.com)',
						status: 'partial_outage',
					},
				],
				incidents: [
					{
						impact: 'major',
						name: 'Elevated Error Rates',
						status: 'investigating',
					},
				],
				scheduled_maintenances: [],
				status: {
					description: 'Minor Service Outage',
					indicator: 'minor',
				},
			},
			async (server) => {
				const row = await checkAnthropicSource(server.baseUrl);

				expect(row.indicator).toBe('major');
				expect(row.summaryText).toBe('Major Service Outage (reported minor)');
				expect(server.requests).toEqual(['/api/v2/summary.json']);
			},
		);
	});

	test('promotes many degraded components above a minor report', async () => {
		await withSummaryBody(
			{
				page: {
					id: 'page',
					name: 'Claude',
					time_zone: 'Etc/UTC',
					updated_at: '2026-07-04T00:00:00.000Z',
					url: 'https://status.claude.com',
				},
				components: [
					{ name: 'claude.ai', status: 'degraded_performance' },
					{
						name: 'Claude API (api.anthropic.com)',
						status: 'degraded_performance',
					},
					{ name: 'Claude Code', status: 'degraded_performance' },
					{ name: 'Claude Cowork', status: 'degraded_performance' },
				],
				incidents: [
					{
						impact: 'minor',
						name: 'Elevated errors across many models',
						status: 'investigating',
					},
				],
				scheduled_maintenances: [],
				status: {
					description: 'Partially Degraded Service',
					indicator: 'minor',
				},
			},
			async (server) => {
				const row = await checkAnthropicSource(server.baseUrl);

				expect(row.indicator).toBe('major');
				expect(row.summaryText).toBe('Major Service Outage (reported minor)');
				expect(server.requests).toEqual(['/api/v2/summary.json']);
			},
		);
	});

	test('derives exit codes from the normalized indicator', async () => {
		await withSummaryFixture('anthropic-down.json', async (downServer) => {
			const downRow = await checkAnthropicSource(downServer.baseUrl);

			await withSummaryFixture('anthropic-up.json', async (upServer) => {
				const upRow = await checkAnthropicSource(upServer.baseUrl);

				expect(summarizeExitCode([downRow])).toBe(2);
				expect(summarizeExitCode([upRow])).toBe(0);
			});
		});
	});
});
