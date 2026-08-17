import { describe, expect, test } from 'bun:test';
import { runCommand } from 'dreamcli/testkit';

import {
	statusApiEndpoint,
	statusApiResourceList,
	statusApiResources,
} from '#claude-down/cli/api';
import type { StatusApiResource } from '#claude-down/cli/api';
import { apiCommand } from '#claude-down/cli/commands';
import { claudeDown } from '#claude-down/cli/index';
import {
	anthropicStatusBaseEnvVar,
	withSummaryFixture,
} from '#test/support/statuspage-fixture.ts';

describe('Status API passthrough', () => {
	const endpointCases: {
		endpoint: string;
		resource: StatusApiResource;
	}[] = [
		{ resource: 'summary', endpoint: '/api/v2/summary.json' },
		{ resource: 'status', endpoint: '/api/v2/status.json' },
		{ resource: 'components', endpoint: '/api/v2/components.json' },
		{ resource: 'incidents', endpoint: '/api/v2/incidents.json' },
		{
			resource: 'incidents/unresolved',
			endpoint: '/api/v2/incidents/unresolved.json',
		},
		{
			resource: 'scheduled-maintenances',
			endpoint: '/api/v2/scheduled-maintenances.json',
		},
		{
			resource: 'scheduled-maintenances/active',
			endpoint: '/api/v2/scheduled-maintenances/active.json',
		},
		{
			resource: 'scheduled-maintenances/upcoming',
			endpoint: '/api/v2/scheduled-maintenances/upcoming.json',
		},
	];

	test.each(endpointCases)(
		'$resource maps to $endpoint',
		({ endpoint, resource }) => {
			expect(statusApiEndpoint(resource)).toBe(endpoint);
		},
	);

	test('enumerates every tested public resource', () => {
		expect([...statusApiResources]).toStrictEqual(
			endpointCases.map(({ resource }) => resource),
		);
		expect(statusApiResourceList()).toHaveLength(endpointCases.length);
		expect(
			statusApiResourceList().map(({ endpoint }) => endpoint),
		).toStrictEqual(endpointCases.map(({ resource }) => resource));
	});

	test.each(['list', 'ls'])(
		'api %s displays available endpoints and descriptions',
		async (subcommand) => {
			const result = await claudeDown.execute(['api', subcommand], {
				isTTY: true,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toEqual([]);
			expect(result.stdout).toHaveLength(1);
			expect(result.stdout[0]).toContain('Endpoint');
			expect(result.stdout[0]).toContain('Description');
			expect(result.stdout[0]).toContain('incidents/unresolved');
			expect(result.stdout[0]).toContain('Currently unresolved incidents');
		},
	);

	test.each([
		{ argv: ['api', 'list'], mode: 'piped output' },
		{ argv: ['api', 'ls', '--json'], mode: 'explicit JSON mode' },
	])('api list emits structured descriptions for $mode', async ({ argv }) => {
		const result = await claudeDown.execute(argv);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toEqual([]);
		expect(result.stdout).toHaveLength(1);
		expect(JSON.parse(result.stdout[0] ?? 'null')).toStrictEqual(
			statusApiResourceList(),
		);
	});

	test('api help advertises the ls alias', async () => {
		const result = await claudeDown.execute(['api', '--help']);
		const help = result.stdout.join('');

		expect(result.exitCode).toBe(0);
		expect(help).toContain(
			'list  List available Status API endpoints (alias: ls)',
		);
		expect(help).toContain('claude-down api ls');
	});

	test('defaults to the summary endpoint and emits its JSON payload', async () => {
		await withSummaryFixture('anthropic-up.json', async (server) => {
			const result = await runCommand(apiCommand, [], {
				env: { [anthropicStatusBaseEnvVar]: server.baseUrl },
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toHaveLength(0);
			expect(result.stdout).toHaveLength(1);
			expect(JSON.parse(result.stdout[0] ?? 'null')).toHaveProperty(
				'status.indicator',
				'none',
			);
			expect(server.requests).toStrictEqual(['/api/v2/summary.json']);
		});
	});

	test('rejects unknown resources before making a request', async () => {
		const result = await runCommand(apiCommand, ['secrets']);

		expect(result.exitCode).toBe(2);
		expect(result.stderr.join('')).toContain('secrets');
		expect(result.stderr.join('')).toContain('incidents/unresolved');
	});
});
