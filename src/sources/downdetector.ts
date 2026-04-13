/**
 * Source A: downdetector (via allestoringen.nl).
 *
 * Community/editor signal — tends to lead Anthropic's official page by
 * several minutes. The page sits behind a Cloudflare TLS-fingerprint
 * challenge, so plain `fetch` gets an interstitial. We spawn a real headless
 * Chromium, drive it over CDP, wait for the CF challenge to clear, then read
 * `window.PogoConfig.outage` out of the SSR'd page.
 *
 * Bounded by a 20s wall-clock deadline.
 */

import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import type { Signal } from '#claude-down/types.ts';

export const DOWNDETECTOR_URL = 'https://allestoringen.nl/en/status/claude-ai/';
export const CHROME_CANDIDATES: readonly string[] = [
	'chromium',
	'google-chrome-stable',
	'google-chrome',
	'brave',
];

/** Locate a Chromium-family binary on $PATH. Returns null if none found. */
export function findChrome(): string | null {
	for (const name of CHROME_CANDIDATES) {
		const p = spawnSync('which', [name]);
		if (p.status === 0 && p.stdout) {
			return p.stdout.toString().trim();
		}
	}
	return null;
}

// CDP / PogoConfig shape guards — reject unknown payloads at the boundary
// instead of trusting `as` casts.

function isTargetInfo(v: unknown): v is { webSocketDebuggerUrl: string } {
	return (
		v !== null
		&& typeof v === 'object'
		&& 'webSocketDebuggerUrl' in v
		&& typeof v.webSocketDebuggerUrl === 'string'
	);
}

function isCdpMessage(v: unknown): v is { id: number } {
	return (
		v !== null
		&& typeof v === 'object'
		&& 'id' in v
		&& typeof v.id === 'number'
	);
}

function isCdpEvalResult(v: unknown): v is { result: { result: { value: string } } } {
	return (
		v !== null
		&& typeof v === 'object'
		&& 'result' in v
		&& typeof v.result === 'object'
		&& v.result !== null
		&& 'result' in v.result
		&& typeof v.result.result === 'object'
		&& v.result.result !== null
		&& 'value' in v.result.result
		&& typeof v.result.result.value === 'string'
	);
}

type PogoSnapshot = {
	title: string;
	pogo: { outage?: boolean } | null;
	h1: string | null;
};

function isPogoSnapshot(v: unknown): v is PogoSnapshot {
	if (typeof v !== 'object' || v === null) return false;
	if (!('title' in v) || typeof v.title !== 'string') return false;
	if ('h1' in v && v.h1 !== null && typeof v.h1 !== 'string') return false;
	if (!('pogo' in v) || v.pogo === null) return true;
	if (typeof v.pogo !== 'object') return false;
	const pogo = v.pogo;
	if ('outage' in pogo && pogo.outage !== undefined && typeof pogo.outage !== 'boolean') return false;
	return true;
}

/**
 * Check downdetector (allestoringen.nl) via headless Chrome driven over CDP.
 *
 * Spawns a real Chromium, lets it solve Cloudflare's TLS-fingerprint
 * challenge, then reads `window.PogoConfig.outage` out of the SSR'd page.
 * Bounded by a 20s wall-clock deadline.
 */
export async function checkDowndetector(): Promise<Signal> {
	const chrome = findChrome();
	if (!chrome) return { ok: false, error: 'no chromium/chrome binary found' };

	let userDataDir: string;
	try {
		userDataDir = mkdtempSync(join(tmpdir(), 'claude-down-'));
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return { ok: false, error: `downdetector: mkdtemp failed: ${msg}` };
	}

	const port = 9222 + Math.floor(Math.random() * 1000);
	let proc: ChildProcess | null = null;

	try {
		proc = spawn(
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

		// Wait for CDP HTTP endpoint to come up.
		const base = `http://localhost:${port}`;
		const cdpDeadline = Date.now() + 5000;
		let cdpUp = false;
		while (Date.now() < cdpDeadline) {
			try {
				const v = await fetch(`${base}/json/version`);
				if (v.ok) {
					cdpUp = true;
					break;
				}
			} catch {}
			await sleep(100);
		}
		if (!cdpUp) return { ok: false, error: 'downdetector: CDP endpoint never came up' };

		// Open a new target pointed at the downdetector page.
		const targetRes = await fetch(
			`${base}/json/new?${encodeURIComponent(DOWNDETECTOR_URL)}`,
			{ method: 'PUT' },
		);
		const targetJson: unknown = await targetRes.json();
		if (!isTargetInfo(targetJson)) {
			return { ok: false, error: 'downdetector: unexpected CDP target shape' };
		}

		// Drive CDP over WebSocket with a simple request/response multiplexer.
		const ws = new WebSocket(targetJson.webSocketDebuggerUrl);
		const pending = new Map<number, (msg: unknown) => void>();
		ws.onmessage = (ev) => {
			const text = typeof ev.data === 'string'
				? ev.data
				: ev.data instanceof ArrayBuffer
				? new TextDecoder().decode(ev.data)
				: null;
			if (text === null) return;
			let parsed: unknown;
			try {
				parsed = JSON.parse(text);
			} catch {
				return;
			}
			if (!isCdpMessage(parsed)) return;
			const cb = pending.get(parsed.id);
			if (cb) {
				pending.delete(parsed.id);
				cb(parsed);
			}
		};
		await new Promise<void>((resolve) => {
			ws.onopen = () => resolve();
		});

		let msgId = 0;
		const send = (
			method: string,
			params: Record<string, unknown> = {},
		): Promise<unknown> =>
			new Promise((resolve) => {
				const id = ++msgId;
				pending.set(id, resolve);
				ws.send(JSON.stringify({ id, method, params }));
			});

		await send('Runtime.enable');

		// Poll PogoConfig until CF challenge clears, up to 20s.
		const deadline = Date.now() + 20000;
		let pogo: { outage?: boolean } | null = null;
		let heading: string | null = null;
		while (Date.now() < deadline) {
			const response = await send('Runtime.evaluate', {
				expression:
					'JSON.stringify({ title: document.title, pogo: window.PogoConfig ?? null, h1: document.querySelector("h1")?.innerText ?? null })',
				returnByValue: true,
			});
			if (isCdpEvalResult(response)) {
				let snapshot: unknown;
				try {
					snapshot = JSON.parse(response.result.result.value);
				} catch {
					snapshot = null;
				}
				if (
					isPogoSnapshot(snapshot)
					&& snapshot.pogo !== null
					&& snapshot.title !== 'Just a moment...'
				) {
					pogo = snapshot.pogo;
					heading = snapshot.h1;
					break;
				}
			}
			await sleep(700);
		}
		ws.close();

		if (!pogo) {
			return { ok: false, error: 'downdetector: CF challenge not cleared in time' };
		}
		if (pogo.outage === true) {
			return { ok: true, down: true, reason: heading ?? 'outage reported' };
		}
		return { ok: true, down: false };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return { ok: false, error: `downdetector: ${msg}` };
	} finally {
		proc?.kill();
		// Retry the dir removal: `proc.kill()` is sync signal delivery, but chrome
		// takes a moment to release its user-data-dir files. Without retries we get
		// flaky ENOTEMPTY.
		rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
	}
}
