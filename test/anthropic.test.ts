import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { after, before, beforeEach, describe, test } from 'node:test';

import checkAnthropic from '#claude-down/lib/anthropic.ts';
import { claudeDown } from '#claude-down/main.ts';

const anthropicFixtureUrl = new URL(import.meta.resolve('#test/fixtures/anthropic-down.json'));
const anthropicStatusBaseEnv = 'CLAUDE_DOWN_ANTHROPIC_STATUS_BASE';

type FixtureServer = {
	baseUrl: string;
	requests: string[];
	stop(): Promise<void>;
};

async function startSummaryFixtureServer(summaryBody: string): Promise<FixtureServer> {
	const requests: string[] = [];
	const server = createServer((req, res) => {
		requests.push(req.url ?? '');

		if (req.method === 'GET' && req.url === '/api/v2/summary.json') {
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(summaryBody);
			return;
		}

		res.writeHead(404, { 'content-type': 'text/plain' });
		res.end('not found');
	});

	server.listen(0, '127.0.0.1');
	await once(server, 'listening');

	const address = server.address();
	if (address === null || typeof address === 'string') {
		await closeServer(server);
		throw new Error('fixture server did not expose a TCP address');
	}

	return {
		baseUrl: `http://127.0.0.1:${address.port}`,
		requests,
		stop: () => closeServer(server),
	};
}

async function closeServer(server: Server): Promise<void> {
	server.close();
	await once(server, 'close');
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

describe('Anthropic status fixture', () => {
	let fixtureBody = '';
	let fixtureServer: FixtureServer;

	before(async () => {
		fixtureBody = await readFile(anthropicFixtureUrl, 'utf8');
		fixtureServer = await startSummaryFixtureServer(fixtureBody);
	});

	after(async () => {
		await fixtureServer.stop();
	});

	beforeEach(() => {
		fixtureServer.requests.length = 0;
	});

	test('checkAnthropic parses the raw summary fixture', async () => {
		const result = await checkAnthropic(fixtureServer.baseUrl);

		assert.equal(result.kind, 'ok');
		if (result.kind !== 'ok') return;

		assert.equal(result.summary.status.indicator, 'major');
		assert.equal(result.summary.status.description, 'Partial System Outage');
		assert.equal(result.summary.incidents[0]?.name, 'Claude.ai unavailable and elevated errors on the API');
		assert.deepEqual(
			result.summary.components
				.filter(component => component.status !== 'operational')
				.map(component => component.name),
			['claude.ai', 'Claude API (api.anthropic.com)', 'Claude Code', 'Claude Cowork'],
		);
		assert.deepEqual(fixtureServer.requests, ['/api/v2/summary.json']);
	});

	test('CLI anthropic subcommand renders human output from the fixture server', async () => {
		const result = await withAnthropicStatusBase(
			fixtureServer.baseUrl,
			() => claudeDown.execute(['anthropic']),
		);

		assert.equal(result.exitCode, 0);
		assert.deepEqual(result.stderr, []);
		assert.deepEqual(result.stdout, [
			[
				'Anthropic: major',
				'  Partial System Outage',
				'  incident: Claude.ai unavailable and elevated errors on the API [identified]',
				'  affected: claude.ai [major_outage], Claude API (api.anthropic.com) [partial_outage], Claude Code [partial_outage], Claude Cowork [major_outage]',
			].join('\n') + '\n',
		]);
		assert.deepEqual(fixtureServer.requests, ['/api/v2/summary.json']);
	});
});
