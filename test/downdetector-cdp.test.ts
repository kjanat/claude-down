import { DOWNDETECTOR_URL } from '#claude-down/lib/constants';
import { openCdpTarget } from '#claude-down/lib/downdetector/cdp';
import { afterEach, describe, expect, test } from 'bun:test';

const originalFetch = globalThis.fetch;
const originalWebSocket = globalThis.WebSocket;

type SentMessage = {
	id: number;
	method: string;
	params?: Record<string, unknown>;
};

afterEach(() => {
	globalThis.fetch = originalFetch;
	globalThis.WebSocket = originalWebSocket;
});

describe(openCdpTarget.name, () => {
	test('creates a blank target and navigates after attaching', async () => {
		const requests: { method: string; url: string }[] = [];
		const sentMessages: SentMessage[] = [];

		class FakeWebSocket {
			onopen: (() => void) | null = null;
			onmessage: ((event: { data: string }) => void) | null = null;

			constructor(readonly url: string) {
				setTimeout(() => this.onopen?.(), 0);
			}

			send(data: string): void {
				const message = JSON.parse(data) as SentMessage;
				sentMessages.push(message);

				setTimeout(() => {
					this.onmessage?.({
						data: JSON.stringify({ id: message.id, result: {} }),
					});
				}, 0);
			}

			close(): void {}
		}

		globalThis.fetch = (async (input, init) => {
			requests.push({
				method: init?.method ?? 'GET',
				url: String(input),
			});

			return new Response(JSON.stringify({
				webSocketDebuggerUrl: 'ws://127.0.0.1/devtools/page/1',
			}));
		}) as typeof fetch;
		globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;

		const target = await openCdpTarget(
			'http://127.0.0.1:9222',
			DOWNDETECTOR_URL,
		);

		expect(target.ok).toBe(true);
		if (!target.ok) throw new Error(target.error);

		expect(requests).toEqual([{
			method: 'PUT',
			url: `http://127.0.0.1:9222/json/new?${
				encodeURIComponent('about:blank')
			}`,
		}]);
		expect(sentMessages.map(({ method, params }) => ({ method, params })))
			.toEqual([
				{ method: 'Page.enable', params: {} },
				{
					method: 'Page.navigate',
					params: { url: DOWNDETECTOR_URL },
				},
			]);

		target.close();
	});
});
