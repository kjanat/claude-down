import { runCommand } from '@kjanat/dreamcli/testkit';
import { file } from 'bun';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import checkAnthropic from '#claude-down/lib/anthropic.ts';
import { anthropicCommand, statusCommand } from '#claude-down/main.ts';

const anthropicFixtureUrl = new URL(import.meta.resolve('#test/fixtures/anthropic-down.json'));
const anthropicStatusBaseEnv = 'CLAUDE_DOWN_ANTHROPIC_STATUS_BASE';

type FixtureServer = {
	baseUrl: string;
	requests: string[];
	stop(): void;
};

async function startSummaryFixtureServer(summaryBody: string): Promise<FixtureServer> {
	const requests: string[] = [];
	const server = Bun.serve({
		hostname: '127.0.0.1',
		port: 0,
		fetch(req) {
			const url = new URL(req.url);
			requests.push(url.pathname);

			if (req.method === 'GET' && url.pathname === '/api/v2/summary.json') {
				return new Response(summaryBody, {
					status: 200,
					headers: { 'content-type': 'application/json' },
				});
			}

			return new Response('not found', {
				status: 404,
				headers: { 'content-type': 'text/plain' },
			});
		},
	});

	return {
		baseUrl: server.url.origin,
		requests,
		stop: () => server.stop(true),
	};
}

async function withAnthropicStatusBase<T>(baseUrl: string, run: () => Promise<T>): Promise<T> {
	const previous = process.env[anthropicStatusBaseEnv];
	process.env[anthropicStatusBaseEnv] = baseUrl;

	try {
		return await run();
	} finally {
		if (previous === undefined) {
			delete process.env[anthropicStatusBaseEnv];
		} else {
			process.env[anthropicStatusBaseEnv] = previous;
		}
	}
}

function requireFixtureServer(fixtureServer: FixtureServer | undefined): FixtureServer {
	if (fixtureServer === undefined) {
		throw new Error('fixture server not started');
	}
	return fixtureServer;
}

describe('Anthropic status fixture', () => {
	let fixtureBody = '';
	let fixtureServer: FixtureServer | undefined;

	beforeAll(async () => {
		fixtureBody = await file(anthropicFixtureUrl).text();
		fixtureServer = await startSummaryFixtureServer(fixtureBody);
	});

	afterAll(async () => {
		if (fixtureServer !== undefined) {
			fixtureServer.stop();
		}
	});

	beforeEach(() => {
		requireFixtureServer(fixtureServer).requests.length = 0;
	});

	test('checkAnthropic parses the raw summary fixture', async () => {
		const server = requireFixtureServer(fixtureServer);
		const result = await checkAnthropic(server.baseUrl);

		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') {
			throw new Error(`expected ok result, got ${result.kind}`);
		}

		expect(result.summary.status.indicator).toBe('major');
		expect(result.summary.status.description).toBe('Partial System Outage');
		expect(result.summary.incidents[0]?.name).toBe('Claude.ai unavailable and elevated errors on the API');
		expect(
			result.summary.components
				.filter(component => component.status !== 'operational')
				.map(component => component.name),
		).toEqual(['claude.ai', 'Claude API (api.anthropic.com)', 'Claude Code', 'Claude Cowork']);
		expect(server.requests).toEqual(['/api/v2/summary.json']);
	});

	test('CLI anthropic subcommand renders human output from the fixture server', async () => {
		const server = requireFixtureServer(fixtureServer);
		const result = await withAnthropicStatusBase(
			server.baseUrl,
			() => runCommand(anthropicCommand, [], { isTTY: true }),
		);

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

	test('status command emits JSON rows when stdout is not a tty', async () => {
		const server = requireFixtureServer(fixtureServer);
		const result = await withAnthropicStatusBase(
			server.baseUrl,
			() => runCommand(statusCommand, ['--source', 'anthropic']),
		);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toEqual([]);
		expect(JSON.parse(result.stdout[0] ?? 'null')).toEqual([
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
		]);
		expect(server.requests).toEqual(['/api/v2/summary.json']);
	});
});
