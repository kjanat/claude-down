import {
	checkWithWebView,
	checkWithWebViewWorker,
} from '#claude-down/lib/downdetector/webview';
import { describe, expect, test } from 'bun:test';

const chromeArgv = [
	'--headless=new',
	'--disable-gpu',
	'--no-sandbox',
	'--disable-blink-features=AutomationControlled',
	'--window-size=1920,1080',
	'--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
] as const;

function expectedOptions(path?: string) {
	if (process.platform === 'darwin' && path === undefined) {
		return { width: 1920, height: 1080 };
	}

	return {
		width: 1920,
		height: 1080,
		backend: {
			type: 'chrome',
			url: false,
			argv: chromeArgv,
			...(path === undefined ? {} : { path }),
		},
	};
}

describe(checkWithWebView.name, () => {
	test('navigates with Bun WebView and maps a non-outage snapshot', async () => {
		let constructedOptions: unknown;
		let navigatedUrl = '';
		let evaluatedExpression = '';
		let closed = false;

		class FakeWebView {
			constructor(options?: unknown) {
				constructedOptions = options;
			}

			async navigate(url: string): Promise<void> {
				navigatedUrl = url;
			}

			async evaluate(expression: string): Promise<unknown> {
				evaluatedExpression = expression;
				return {
					title: 'Claude AI status',
					pogo: { outage: false },
					h1: 'Claude AI',
				};
			}

			close(): void {
				closed = true;
			}
		}

		const result = await checkWithWebView(
			FakeWebView,
			'https://downdetector.com/status/claude-ai/',
		);

		expect(result).toEqual({ ok: true, down: false });
		expect(constructedOptions).toEqual(expectedOptions());
		expect(navigatedUrl).toBe('https://downdetector.com/status/claude-ai/');
		expect(evaluatedExpression).toContain('window.PogoConfig');
		expect(closed).toBe(true);
	});

	test('uses an explicit Chrome path through WebView backend options', async () => {
		let constructedOptions: unknown;

		class FakeWebView {
			constructor(options?: unknown) {
				constructedOptions = options;
			}

			async navigate(): Promise<void> {}

			async evaluate(): Promise<unknown> {
				return {
					title: 'Claude AI status',
					pogo: { outage: true },
					h1: 'User reports indicate problems at Claude AI',
				};
			}

			close(): void {}
		}

		const result = await checkWithWebView(
			FakeWebView,
			'https://downdetector.com/status/claude-ai/',
			'/usr/bin/chromium',
		);

		expect(result).toEqual({
			ok: true,
			down: true,
			reason: 'User reports indicate problems at Claude AI',
		});
		expect(constructedOptions).toEqual(expectedOptions('/usr/bin/chromium'));
	});

	test('reports Cloudflare challenge pages without waiting for timeout', async () => {
		let evaluateCount = 0;
		let closed = false;

		class FakeWebView {
			async navigate(): Promise<void> {}

			async evaluate(): Promise<unknown> {
				evaluateCount += 1;
				return {
					title: 'Just a moment...',
					pogo: null,
					h1: null,
					cfChallenge: true,
				};
			}

			close(): void {
				closed = true;
			}
		}

		const result = await checkWithWebView(
			FakeWebView,
			'https://downdetector.com/status/claude-ai/',
		);

		expect(result).toEqual({ ok: false, error: 'Cloudflare challenge page' });
		expect(evaluateCount).toBe(1);
		expect(closed).toBe(true);
	});
});

describe(checkWithWebViewWorker.name, () => {
	test('returns unavailable instead of hanging when browser navigation stalls', async () => {
		const result = await checkWithWebViewWorker(
			'about:blank',
			undefined,
			1,
		);

		expect(result).toEqual({ ok: false, error: 'Bun.WebView timed out' });
	});
});
