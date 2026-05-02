import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { BROWSER_CANDIDATES } from '#claude-down/lib/constants.ts';

/** Represents a launched headless browser instance. */
type LaunchedBrowser = {
	/** The child process of the launched browser. */
	proc: ChildProcess;
	/** The temporary user data directory used by the browser. */
	userDataDir: string;
	/** The base URL for the browser's CDP endpoint (e.g., `'http://localhost:9222'`). */
	base: string;
};

/** Represents the result of attempting to launch a browser, including success or failure information. */
type LaunchBrowserResult =
	| { ok: true; browser: LaunchedBrowser }
	| { ok: false; error: string };

/** Attempts to find the path to a Chrome or Chromium executable by checking common candidates. */
function findChrome(): string | null {
	for (const name of BROWSER_CANDIDATES) {
		const result = spawnSync('which', [name]);
		if (result.status === 0 && result.stdout) {
			return result.stdout.toString().trim();
		}
	}

	return null;
}

/** Waits for the Chrome DevTools Protocol (CDP) endpoint to become available at the specified base URL within a given timeout.
 *
 * @param base - The base URL of the CDP endpoint, e.g., `'http://localhost:9222'`.
 * @param timeoutMs - The maximum time to wait for the CDP endpoint to become available, in milliseconds.
 * @returns A promise that resolves to `true` if the CDP endpoint became available within the timeout, or `false` if it did not.
 */
async function waitForCdp(base: string, timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const response = await fetch(`${base}/json/version`);
			if (response.ok) return true;
		} catch {
			// retry until deadline
		}

		await sleep(100);
	}

	return false;
}

/** Launches a headless Chrome browser with a temporary user data directory and remote debugging enabled.
 *
 * @param chrome - The path to the Chrome executable to launch.
 * @returns A promise that resolves to a `LaunchBrowserResult` indicating success or failure, including the launched browser instance on success or an error message on failure.
 */
async function launchBrowser(chrome: string): Promise<LaunchBrowserResult> {
	let userDataDir: string;
	try {
		userDataDir = mkdtempSync(join(tmpdir(), 'claude-down-'));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, error: `mkdtemp failed: ${message}` };
	}

	const port = 9222 + Math.floor(Math.random() * 1000);
	const proc = spawn(
		chrome,
		[
			'--headless=new',
			'--disable-gpu',
			'--no-sandbox',
			'--disable-blink-features=AutomationControlled',
			'--window-size=1920,1080',
			`--user-data-dir=${userDataDir}`,
			`--remote-debugging-port=${port}`,
			'--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
			'about:blank',
		],
		{ stdio: 'ignore' },
	);

	const base = `http://localhost:${port}`;
	if (!await waitForCdp(base, 5000)) {
		cleanupBrowser(proc, userDataDir);
		return { ok: false, error: 'CDP endpoint never came up' };
	}

	return { ok: true, browser: { proc, userDataDir, base } };
}

/** Cleans up a launched browser instance by killing the process and removing the temporary user data directory.
 *
 * @param proc - The child process of the launched browser to kill.
 * @param userDataDir - The path to the temporary user data directory to remove.
 */
function cleanupBrowser(proc: ChildProcess, userDataDir: string): void {
	proc.kill();
	rmSync(userDataDir, {
		recursive: true,
		force: true,
		maxRetries: 5,
		retryDelay: 100,
	});
}

export { cleanupBrowser, findChrome, launchBrowser };
export type { LaunchedBrowser };
