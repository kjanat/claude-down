import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { BROWSER_CANDIDATES, DOWNDETECTOR_URL } from '#claude-down/lib/constants.ts';
import type { Signal } from '#claude-down/lib/types.ts';

function findChrome(): string | null {
	for (const name of BROWSER_CANDIDATES) {
		const p = spawnSync('which', [name]);
		if (p.status === 0 && p.stdout) {
			return p.stdout.toString().trim();
		}
	}
	return null;
}

function isTargetInfo(v: unknown): v is { webSocketDebuggerUrl: string } {
	return (
		v !== null
		&& typeof v === 'object'
		&& 'webSocketDebuggerUrl' in v
		&& typeof v.webSocketDebuggerUrl === 'string'
	);
}

/**
 * Type guard to check if a given value conforms to the expected shape of a CDP message with an `id` property.
 *
 * This function verifies that the input is an object with an `id` property of type number.
 *
 * @param v - The value to check.
 * @returns True if the value is a valid CDP message with an `id`, false otherwise.
 */
function isCdpMessage(v: unknown): v is { id: number } {
	return v !== null && typeof v === 'object' && 'id' in v && typeof v.id === 'number';
}

/**
 * Type guard to check if a given value conforms to the expected shape of a CDP evaluation result.
 *
 * This function verifies that the input is an object with a nested structure containing a `value` property of type string.
 *
 * @param v - The value to check.
 * @returns True if the value is a valid CDP evaluation result, false otherwise.
 */
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

/**
 * Type definition for the snapshot of the Downdetector page, including the title, Pogo configuration, and heading.
 *
 * This type represents the structure of the data extracted from the Downdetector page after clearing the Cloudflare challenge.
 * The `pogo` property may contain an `outage` boolean indicating whether an outage is reported, or it may be null if not present.
 * The `h1` property represents the text content of the first heading on the page, which may provide additional context about the outage.
 */
type PogoSnapshot = {
	title: string;
	pogo: { outage?: boolean } | null;
	h1: string | null;
};

/**
 * Type guard to check if a given value conforms to the expected shape of a PogoSnapshot object.
 *
 * This function verifies that the input is an object with the required properties (`title`, `pogo`, and optionally `h1`) and that they have the correct types.
 *
 * @param v - The value to check.
 * @returns True if the value is a valid PogoSnapshot, false otherwise.
 */
function isPogoSnapshot(v: unknown): v is PogoSnapshot {
	if (typeof v !== 'object' || v === null) return false;
	if (!('title' in v) || typeof v.title !== 'string') return false;
	if ('h1' in v && v.h1 !== null && typeof v.h1 !== 'string') return false;
	if (!('pogo' in v)) return false;
	if (v.pogo === null) return true;
	if (typeof v.pogo !== 'object') return false;
	const pogo = v.pogo;
	if ('outage' in pogo && pogo.outage !== undefined && typeof pogo.outage !== 'boolean') return false;
	return true;
}

type CdpSend = (method: string, params?: Record<string, unknown>) => Promise<unknown>;

async function waitForCdp(base: string, timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const v = await fetch(`${base}/json/version`);
			if (v.ok) return true;
		} catch {
			// retry
		}
		await sleep(100);
	}
	return false;
}

function createCdpConnection(ws: WebSocket): CdpSend {
	const pending = new Map<number, (msg: unknown) => void>();
	let msgId = 0;

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

	return (method, params = {}) =>
		new Promise((resolve, reject) => {
			const id = ++msgId;
			const timer = setTimeout(() => {
				pending.delete(id);
				reject(new Error(`CDP command '${method}' timed out`));
			}, 5000);
			pending.set(id, (msg) => {
				clearTimeout(timer);
				resolve(msg);
			});
			ws.send(JSON.stringify({ id, method, params }));
		});
}

async function pollPogoSnapshot(
	send: CdpSend,
	timeoutMs: number,
): Promise<{ pogo: { outage?: boolean }; heading: string | null } | null> {
	await send('Runtime.enable');

	const deadline = Date.now() + timeoutMs;
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
				return { pogo: snapshot.pogo, heading: snapshot.h1 };
			}
		}
		await sleep(700);
	}
	return null;
}

async function check(): Promise<Signal> {
	const chrome = findChrome();
	if (!chrome) return { ok: false, error: 'no chromium/chrome binary found' };

	let userDataDir: string;
	try {
		userDataDir = mkdtempSync(join(tmpdir(), 'claude-down-'));
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return { ok: false, error: `mkdtemp failed: ${msg}` };
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

		const base = `http://localhost:${port}`;
		if (!await waitForCdp(base, 5000)) {
			return { ok: false, error: 'CDP endpoint never came up' };
		}

		const targetRes = await fetch(`${base}/json/new?${encodeURIComponent(DOWNDETECTOR_URL)}`, {
			method: 'PUT',
		});
		const targetJson: unknown = await targetRes.json();
		if (!isTargetInfo(targetJson)) {
			return { ok: false, error: 'unexpected CDP target shape' };
		}

		const ws = new WebSocket(targetJson.webSocketDebuggerUrl);
		const send = createCdpConnection(ws);
		await new Promise<void>((resolve, reject) => {
			ws.onopen = () => resolve();
			ws.onerror = () => reject(new Error('WebSocket connection failed'));
			ws.onclose = () => reject(new Error('WebSocket closed before opening'));
		});

		const result = await pollPogoSnapshot(send, 20000);
		ws.close();

		if (!result) {
			return { ok: false, error: 'CF challenge not cleared in time' };
		}
		if (result.pogo.outage === true) {
			return { ok: true, down: true, reason: result.heading ?? 'outage reported' };
		}
		return { ok: true, down: false };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return { ok: false, error: msg };
	} finally {
		proc?.kill();
		rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
	}
}

export { check as checkDownDetector, check as default };
