import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { BROWSER_CANDIDATES } from '#claude-down/lib/constants.ts';

type LaunchedBrowser = {
	proc: ChildProcess;
	userDataDir: string;
	base: string;
};

type LaunchBrowserResult =
	| { ok: true; browser: LaunchedBrowser }
	| { ok: false; error: string };

function findChrome(): string | null {
	for (const name of BROWSER_CANDIDATES) {
		const result = spawnSync('which', [name]);
		if (result.status === 0 && result.stdout) {
			return result.stdout.toString().trim();
		}
	}

	return null;
}

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

function cleanupBrowser(proc: ChildProcess, userDataDir: string): void {
	proc.kill();
	rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

export { cleanupBrowser, findChrome, launchBrowser };
export type { LaunchedBrowser };
