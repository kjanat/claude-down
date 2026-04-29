import { DOWNDETECTOR_URL } from '#claude-down/lib/constants.ts';
import { openCdpTarget } from '#claude-down/lib/downdetector/cdp.ts';
import { cleanupBrowser, findChrome, launchBrowser } from '#claude-down/lib/downdetector/chrome.ts';
import { pollPogoSnapshot } from '#claude-down/lib/downdetector/snapshot.ts';
import type { Signal } from '#claude-down/lib/types.ts';

async function check(): Promise<Signal> {
	const chrome = findChrome();
	if (chrome === null) {
		return { ok: false, error: 'no chromium/chrome binary found' };
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

		if (result.pogo.outage === true) {
			return { ok: true, down: true, reason: result.heading ?? 'outage reported' };
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
