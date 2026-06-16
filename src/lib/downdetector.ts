import { DOWNDETECTOR_URL } from '#claude-down/lib/constants';
import { openCdpTarget } from '#claude-down/lib/downdetector/cdp';
import {
	cleanupBrowser,
	findChrome,
	launchBrowser,
} from '#claude-down/lib/downdetector/chrome';
import { pollPogoSnapshot } from '#claude-down/lib/downdetector/snapshot';
import {
	checkDownDetectorWithWebView,
	isBunRuntime,
} from '#claude-down/lib/downdetector/webview';
import type { Signal } from '#claude-down/lib/types';

/** Checks the status of Claude AI on Downdetector.
 *
 * Launches a headless Chromium browser, navigates to the Downdetector status
 * page for Claude AI, and polls for the presence of a "Pogo Snapshot" element
 * that indicates whether there is an outage.
 *
 * If an outage is detected, it extracts the reason from the page.
 *
 * @param chromePath Optional explicit Chrome/Chromium binary to use.
 * @returns A promise of {@linkcode Signal}.
 * @see {@link https://downdetector.com/status/claude-ai/} for the target page.
 */
async function check(chromePath?: string): Promise<Signal> {
	if (isBunRuntime()) {
		return checkDownDetectorWithWebView(DOWNDETECTOR_URL, chromePath);
	}

	const chrome = findChrome(chromePath);
	if (chrome === null) {
		return {
			ok: false,
			error:
				'no Chrome/Chromium found; set CLAUDE_DOWN_CHROME or pass --chrome <path>',
		};
	}

	const launched = await launchBrowser(chrome);
	if (!launched.ok) {
		return launched;
	}

	const {
		browser: { proc, userDataDir, base },
	} = launched;

	try {
		const target = await openCdpTarget(base, DOWNDETECTOR_URL);
		if (!target.ok) {
			return target;
		}

		const result = await pollPogoSnapshot(target.send, 20000);
		target.close();

		if (result === null) {
			return { ok: false, error: 'CF challenge not cleared in time' };
		}
		if (result.kind === 'cloudflare-challenge') {
			return { ok: false, error: 'Cloudflare challenge page' };
		}

		if (result.pogo.outage === true) {
			return {
				ok: true,
				down: true,
				reason: result.heading ?? 'outage reported',
			};
		}

		return { ok: true, down: false };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, error: message };
	} finally {
		cleanupBrowser(proc, userDataDir);
	}
}

export { check as checkDownDetector, check as default };
