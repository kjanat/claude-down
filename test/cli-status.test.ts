import { runCommand } from '@kjanat/dreamcli/testkit';
import { describe, expect, test } from 'bun:test';

import { anthropicCommand, statusCommand } from '#claude-down/cli/commands.ts';
import { claudeDown } from '#claude-down/cli/index.ts';
import { anthropicStatusBaseEnvVar, withSummaryFixture } from '#test/support/statuspage-fixture.ts';

function downOutputRow() {
	return [
		{
			source: 'anthropic',
			status: 'major',
			details: 'Partial System Outage',
			incidents: [
				{ name: 'Claude.ai unavailable and elevated errors on the API', status: 'identified' },
			],
			affected: [
				{ name: 'claude.ai', status: 'major_outage' },
				{ name: 'Claude API (api.anthropic.com)', status: 'partial_outage' },
				{ name: 'Claude Code', status: 'partial_outage' },
				{ name: 'Claude Cowork', status: 'major_outage' },
			],
		},
	];
}

function upOutputRow() {
	return [
		{
			source: 'anthropic',
			status: 'up',
			details: 'All Systems Operational',
			incidents: null,
			affected: null,
		},
	];
}

describe('CLI status output', () => {
	test('renders Anthropic down fixture as human output in TTY mode', async () => {
		await withSummaryFixture('anthropic-down.json', async (server) => {
			const result = await runCommand(anthropicCommand, [], {
				env: { [anthropicStatusBaseEnvVar]: server.baseUrl },
				isTTY: true,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toEqual([]);
			expect(result.stdout).toEqual([
				`\
Anthropic
  Partial System Outage
  Active incident:
    - Claude.ai unavailable and elevated errors on the API (identified)
  Affected components:
    - claude.ai
    - Claude API (api.anthropic.com)
    - Claude Code
    - Claude Cowork
`,
			]);
			expect(server.requests).toEqual(['/api/v2/summary.json']);
		});
	});

	test('renders Anthropic up fixture as human output in TTY mode', async () => {
		await withSummaryFixture('anthropic-up.json', async (server) => {
			const result = await runCommand(anthropicCommand, [], {
				env: { [anthropicStatusBaseEnvVar]: server.baseUrl },
				isTTY: true,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toEqual([]);
			expect(result.stdout).toEqual(['Anthropic\n  All Systems Operational\n']);
			expect(server.requests).toEqual(['/api/v2/summary.json']);
		});
	});

	test('root CLI dispatches explicit status command with down fixture JSON output', async () => {
		await withSummaryFixture('anthropic-down.json', async (server) => {
			const result = await claudeDown.execute(['status', '--source', 'anthropic'], {
				env: { [anthropicStatusBaseEnvVar]: server.baseUrl },
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toEqual([]);
			expect(JSON.parse(result.stdout[0] ?? 'null')).toEqual(downOutputRow());
			expect(server.requests).toEqual(['/api/v2/summary.json']);
		});
	});

	test('status command emits up fixture JSON output when stdout is not a tty', async () => {
		await withSummaryFixture('anthropic-up.json', async (server) => {
			const result = await runCommand(statusCommand, ['--source', 'anthropic'], {
				env: { [anthropicStatusBaseEnvVar]: server.baseUrl },
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toEqual([]);
			expect(JSON.parse(result.stdout[0] ?? 'null')).toEqual(upOutputRow());
			expect(server.requests).toEqual(['/api/v2/summary.json']);
		});
	});
});
