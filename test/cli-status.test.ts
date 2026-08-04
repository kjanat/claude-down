import {
	anthropicCommand,
	createWebCommand,
	statusCommand,
} from '#claude-down/cli/commands';
import { claudeDown } from '#claude-down/cli/index';
import { renderStatusRow } from '#claude-down/cli/render';
import { EXIT_CODES } from '#claude-down/lib/constants';
import pkg from '#pkg' with { type: 'json' };
import {
	anthropicStatusBaseEnvVar,
	withSummaryFixture,
} from '#test/support/statuspage-fixture.ts';
import { strip } from 'ansispeck';
import { serve } from 'bun';
import { describe, expect, test } from 'bun:test';
import { ExitError } from 'dreamcli/runtime';
import { createTestAdapter, runCommand } from 'dreamcli/testkit';

function downOutputRow() {
	return [
		{
			source: 'anthropic',
			status: 'major',
			details: 'Partial System Outage',
			incidents: [
				{
					name: 'Claude.ai unavailable and elevated errors on the API',
					status: 'identified',
				},
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

// We only assert on the plain text this package produces, plus whether
// styling is present — not on the exact escape bytes ansispeck emits for a
// given style, which is that package's own API surface, not ours.
const ESCAPE = /\x1b/;

// Trailing pointer to the web page, appended under human (TTY) status output.
// Emitted through `out.status()`, so it lands on stderr and stdout stays
// pipeable.
const PAGE_FOOTER_PLAIN = `\nWatch the live status page: ${pkg.homepage}\n`;

async function withClosedPort<T>(
	run: (baseUrl: string) => Promise<T>,
): Promise<T> {
	const probe = serve({
		hostname: '127.0.0.1',
		port: 0,
		fetch: () => new Response(),
	});
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
	test('can render a streamed row with a leading blank line', () => {
		const stdout: string[] = [];
		const out = {
			isTTY: false,
			jsonMode: false,
			log: (line: string) => stdout.push(line),
		} as unknown as Parameters<typeof renderStatusRow>[1];

		renderStatusRow(
			{
				source: 'downdetector',
				indicator: 'major',
				summaryText: 'User reports show problems with Claude AI',
				reportsOutage: true,
			},
			out,
			{ leadingBlank: true },
		);

		expect(stdout).toEqual([
			'\nDowndetector\n  User reports show problems with Claude AI',
		]);
	});

	test('root help ignores cwd package metadata', async () => {
		const result = await runRootCli(['--help']);
		const output = result.stdout[0] ?? '';

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toEqual([]);
		expect(output.startsWith(`claude-down v${pkg.version}\n`)).toBe(true);
		expect(output).toContain('Usage: claude-down [command] [options]');
		expect(output).toContain(
			'status (default)  Check Claude status across Anthropic and Downdetector',
		);
		expect(output).toContain('claude-down [flags]');
		expect(output).toContain('web');
		expect(output).not.toContain('actup');
		expect(output).not.toContain('0.0.0+dev');
	});

	test('root version ignores cwd package metadata', async () => {
		const result = await runRootCli(['--version']);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toEqual([]);
		expect(result.stdout).toEqual([`${pkg.version}\n`]);
	});

	test('web command opens the live status page', async () => {
		const opened: string[] = [];
		const command = createWebCommand((url) => {
			opened.push(url);
		});

		const result = await runCommand(command, []);

		expect(result.exitCode).toBe(0);
		// The note is status-channel chatter: stderr, suppressed by `--quiet`.
		expect(result.stdout).toEqual([]);
		expect(result.stderr).toEqual([`Opening ${pkg.homepage}\n`]);
		expect(opened).toEqual([pkg.homepage]);
	});

	test('web command exposes site alias', () => {
		expect(createWebCommand().schema.aliases).toContain('site');
	});

	test('renders Anthropic down fixture as human output in TTY mode', async () => {
		await withSummaryFixture('anthropic-down.json', async (server) => {
			const result = await runCommand(anthropicCommand, [], {
				env: { [anthropicStatusBaseEnvVar]: server.baseUrl },
				isTTY: true,
			});

			expect(result.exitCode).toBe(EXIT_CODES.major);
			expect(result.stdout).toHaveLength(1);
			const [body] = result.stdout as [string];
			expect(body).toMatch(ESCAPE);
			expect(strip(body)).toBe(`\
Anthropic
  Partial System Outage
  Active incident:
    - Claude.ai unavailable and elevated errors on the API (identified)
  Affected components:
    - claude.ai
    - Claude API (api.anthropic.com)
    - Claude Code
    - Claude Cowork
`);
			expect(result.stderr.map(strip)).toEqual([PAGE_FOOTER_PLAIN]);
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
			expect(result.stdout).toHaveLength(1);
			const [body] = result.stdout as [string];
			expect(body).toMatch(ESCAPE);
			expect(strip(body)).toBe('Anthropic\n  All Systems Operational\n');
			expect(result.stderr.map(strip)).toEqual([PAGE_FOOTER_PLAIN]);
			expect(server.requests).toEqual(['/api/v2/summary.json']);
		});
	});

	test('root CLI dispatches explicit status command with down fixture JSON output', async () => {
		await withSummaryFixture('anthropic-down.json', async (server) => {
			const result = await claudeDown.execute(
				['status', '--source', 'anthropic'],
				{
					env: { [anthropicStatusBaseEnvVar]: server.baseUrl },
				},
			);

			expect(result.exitCode).toBe(EXIT_CODES.major);
			expect(result.stderr).toEqual([]);
			expect(JSON.parse(result.stdout[0] ?? 'null')).toEqual(downOutputRow());
			expect(server.requests).toEqual(['/api/v2/summary.json']);
		});
	});

	test('status command emits up fixture JSON output when stdout is not a tty', async () => {
		await withSummaryFixture('anthropic-up.json', async (server) => {
			const result = await runCommand(
				statusCommand,
				['--source', 'anthropic'],
				{ env: { [anthropicStatusBaseEnvVar]: server.baseUrl } },
			);

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

			expect(result.exitCode).toBe(EXIT_CODES.unavailable);
			expect(result.stdout).toHaveLength(1);
			const [body] = result.stdout as [string];
			expect(body).toMatch(ESCAPE);
			expect(strip(body)).toMatch(/^Anthropic\n {2}Unavailable: /);
			expect(result.stderr.map(strip)).toEqual([PAGE_FOOTER_PLAIN]);
		});
	});

	test('streams a spinner and the row in interactive (TTY) mode', async () => {
		await withSummaryFixture('anthropic-up.json', async (server) => {
			const result = await runCommand(
				statusCommand,
				['--source', 'anthropic'],
				{
					env: { [anthropicStatusBaseEnvVar]: server.baseUrl },
					isTTY: true,
				},
			);

			expect(result.exitCode).toBe(0);
			// The result row streams to stdout as styled human output, with a
			// trailing pointer to the web page on the stderr status channel.
			expect(result.stdout).toHaveLength(1);
			const [body] = result.stdout as [string];
			expect(body).toMatch(ESCAPE);
			expect(strip(body)).toBe('Anthropic\n  All Systems Operational\n');
			expect(result.stderr.map(strip)).toEqual([PAGE_FOOTER_PLAIN]);
			// A spinner brackets the check: started naming the source, stopped
			// once the row is ready to print.
			expect(result.activity).toEqual([
				{ type: 'spinner:start', text: 'Checking Anthropic…' },
				{ type: 'spinner:stop' },
			]);
		});
	});

	test('does not spin or stream when stdout is not a tty', async () => {
		await withSummaryFixture('anthropic-up.json', async (server) => {
			const result = await runCommand(
				statusCommand,
				['--source', 'anthropic'],
				{
					env: { [anthropicStatusBaseEnvVar]: server.baseUrl },
				},
			);

			expect(result.exitCode).toBe(0);
			// Non-TTY stays machine-bound: a single JSON array, no spinner, no
			// human page-footer leaking into stdout.
			expect(result.activity).toEqual([]);
			expect(result.stdout).toHaveLength(1);
			expect(result.stdout.join('')).not.toContain(pkg.homepage);
			expect(JSON.parse(result.stdout[0] ?? 'null')).toEqual(upOutputRow());
		});
	});

	test('quiet mode suppresses the spinner even in a tty', async () => {
		await withSummaryFixture('anthropic-up.json', async (server) => {
			const result = await runCommand(
				statusCommand,
				['--source', 'anthropic', '--quiet'],
				{
					env: { [anthropicStatusBaseEnvVar]: server.baseUrl },
					isTTY: true,
				},
			);

			expect(result.exitCode).toBe(0);
			expect(result.activity).toEqual([]);
			expect(result.stdout).toEqual([]);
			expect(result.stderr).toEqual([]);
		});
	});

	test('splits comma-separated sources and dedupes repeats', async () => {
		await withSummaryFixture('anthropic-up.json', async (server) => {
			const result = await runCommand(
				statusCommand,
				['--source', 'anthropic,anthropic', '--source', 'anthropic'],
				{ env: { [anthropicStatusBaseEnvVar]: server.baseUrl } },
			);

			expect(result.exitCode).toBe(0);
			// dreamcli's `.separator(',')`/`.unique()` collapse the selection to
			// one source, so Anthropic is queried exactly once.
			expect(server.requests).toEqual(['/api/v2/summary.json']);
			expect(JSON.parse(result.stdout[0] ?? 'null')).toEqual(upOutputRow());
		});
	});

	test('status command emits unavailable JSON when source is unreachable', async () => {
		await withClosedPort(async (baseUrl) => {
			const result = await runCommand(
				statusCommand,
				['--source', 'anthropic'],
				{ env: { [anthropicStatusBaseEnvVar]: baseUrl } },
			);

			expect(result.exitCode).toBe(EXIT_CODES.unavailable);
			expect(result.stderr).toEqual([]);
			const parsed = JSON.parse(result.stdout[0] ?? 'null');
			expect(parsed).toHaveLength(1);
			expect(parsed[0].source).toBe('anthropic');
			expect(parsed[0].status).toBe('unavailable');
			expect(typeof parsed[0].details).toBe('string');
		});
	});
});
