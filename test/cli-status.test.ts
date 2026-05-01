import { ExitError } from '@kjanat/dreamcli/runtime';
import { createTestAdapter, runCommand } from '@kjanat/dreamcli/testkit';
import { describe, expect, test } from 'bun:test';
import pkg from 'claude-down/package.json' with { type: 'json' };

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

const ANTHROPIC_LINK_OPEN = '\x1b]8;;https://status.claude.com\x1b\\';
const LINK_CLOSE = '\x1b]8;;\x1b\\';
const RESET = '\x1b[0m';
const BOLD_RED = '\x1b[1m\x1b[31m';
const BOLD_GREEN = '\x1b[1m\x1b[32m';
const BOLD_DIM = '\x1b[1m\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';

async function withClosedPort<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
	const probe = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() });
	const baseUrl = probe.url.origin;
	probe.stop(true);
	return run(baseUrl);
}

async function runRootCli(argv: readonly string[]) {
	const stdout: string[] = [];
	const stderr: string[] = [];
	const adapter = createTestAdapter({
		argv: ['node', '/usr/bin/claude-down', ...argv],
		cwd: '/work/actup-v2',
		stdout: (line) => {
			stdout.push(line);
		},
		stderr: (line) => {
			stderr.push(line);
		},
		readFile: async (path) => {
			if (path !== '/work/actup-v2/package.json') return null;
			return JSON.stringify({
				name: 'actup',
				version: '0.0.0+dev',
				bin: { actup: './dist/cli.mjs' },
			});
		},
	});

	try {
		await claudeDown.run({ adapter });
	} catch (error: unknown) {
		if (error instanceof ExitError) {
			return { exitCode: error.code, stderr, stdout };
		}
		throw error;
	}

	throw new Error('expected CLI run to exit');
}

describe('CLI status output', () => {
	test('root help ignores cwd package metadata', async () => {
		const result = await runRootCli(['--help']);
		const output = result.stdout[0] ?? '';

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toEqual([]);
		expect(output.startsWith(`claude-down v${pkg.version}\n`)).toBe(true);
		expect(output).toContain('Usage: claude-down <command> [options]');
		expect(output).not.toContain('actup');
		expect(output).not.toContain('0.0.0+dev');
	});

	test('root version ignores cwd package metadata', async () => {
		const result = await runRootCli(['--version']);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toEqual([]);
		expect(result.stdout).toEqual([`${pkg.version}\n`]);
	});

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
${ANTHROPIC_LINK_OPEN}${BOLD_RED}Anthropic${RESET}${LINK_CLOSE}
  ${RED}Partial System Outage${RESET}
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
			expect(result.stdout).toEqual([
				`${ANTHROPIC_LINK_OPEN}${BOLD_GREEN}Anthropic${RESET}${LINK_CLOSE}\n  ${GREEN}All Systems Operational${RESET}\n`,
			]);
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

	test('renders Anthropic unavailable as a dim row in TTY mode', async () => {
		await withClosedPort(async (baseUrl) => {
			const result = await runCommand(anthropicCommand, [], {
				env: { [anthropicStatusBaseEnvVar]: baseUrl },
				isTTY: true,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toEqual([]);
			expect(result.stdout).toHaveLength(1);
			const [body] = result.stdout;
			expect(body).toContain(`${ANTHROPIC_LINK_OPEN}${BOLD_DIM}Anthropic${RESET}${LINK_CLOSE}`);
			expect(body).toMatch(new RegExp(`^.+\\n  ${DIM.replace(/\[/g, '\\[')}Unavailable: `));
		});
	});

	test('status command emits unavailable JSON when source is unreachable', async () => {
		await withClosedPort(async (baseUrl) => {
			const result = await runCommand(statusCommand, ['--source', 'anthropic'], {
				env: { [anthropicStatusBaseEnvVar]: baseUrl },
			});

			expect(result.exitCode).toBe(0);
			expect(result.stderr).toEqual([]);
			const parsed = JSON.parse(result.stdout[0] ?? 'null');
			expect(parsed).toHaveLength(1);
			expect(parsed[0].source).toBe('anthropic');
			expect(parsed[0].status).toBe('unavailable');
			expect(typeof parsed[0].details).toBe('string');
		});
	});
});
