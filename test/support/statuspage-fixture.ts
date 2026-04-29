import { file } from 'bun';

const anthropicStatusBaseEnvVar = 'CLAUDE_DOWN_ANTHROPIC_STATUS_BASE';

type SummaryFixtureName = 'anthropic-down.json' | 'anthropic-up.json';

type FixtureServer = {
	baseUrl: string;
	requests: string[];
	stop(): void;
};

async function readSummaryFixture(fixtureName: SummaryFixtureName): Promise<string> {
	return file(new URL(import.meta.resolve(`#test/fixtures/${fixtureName}`))).text();
}

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

async function withSummaryFixture<T>(
	fixtureName: SummaryFixtureName,
	run: (server: FixtureServer) => Promise<T>,
): Promise<T> {
	const server = await startSummaryFixtureServer(await readSummaryFixture(fixtureName));

	try {
		return await run(server);
	} finally {
		server.stop();
	}
}

export { anthropicStatusBaseEnvVar, withSummaryFixture };
export type { FixtureServer, SummaryFixtureName };
