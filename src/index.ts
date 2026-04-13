/**
 * claude-down — tell if Claude is down.
 *
 * Library entry: types and pure functions for two independent sources:
 *   A. downdetector (via allestoringen.nl) — community/editor signal, tends
 *      to lead Anthropic's official page by several minutes. Behind a
 *      Cloudflare TLS-fingerprint challenge, so we drive a real headless
 *      Chromium via CDP and read `window.PogoConfig.outage`.
 *   B. status.claude.com — Anthropic's own Statuspage.io summary.json.
 *
 * The CLI in `./main.ts` OR's both sources.
 *
 * Sources:
 *   https://status.claude.com/api/v2/summary.json  (Statuspage.io format)
 *   https://allestoringen.nl/en/status/claude-ai/  (downdetector SSR page)
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const STATUS_URL = 'https://status.claude.com/api/v2/summary.json';
export const DOWNDETECTOR_URL = 'https://allestoringen.nl/en/status/claude-ai/';
export const CHROME_CANDIDATES: readonly string[] = [
	'chromium',
	'google-chrome-stable',
	'google-chrome',
	'brave',
];

export type Indicator = 'none' | 'minor' | 'major' | 'critical';

export type Component = {
	name: string;
	status:
		| 'operational'
		| 'degraded_performance'
		| 'partial_outage'
		| 'major_outage'
		| 'under_maintenance';
};

export type Incident = {
	name: string;
	status: string;
	impact: Indicator;
	shortlink?: string;
};

export type Summary = {
	status: { indicator: Indicator; description: string };
	components: Component[];
	incidents: Incident[];
};

export type Result =
	| { kind: 'ok'; summary: Summary }
	| { kind: 'unknown'; reason: string };

/** Per-source health signal. OR'd by the CLI to produce an overall state. */
export type Signal =
	| { ok: true; down: false }
	| { ok: true; down: true; reason: string }
	| { ok: false; error: string };

export async function fetchSummary(): Promise<Result> {
	let res: Response;
	try {
		res = await fetch(STATUS_URL, { redirect: 'follow' });
	} catch (e) {
		return { kind: 'unknown', reason: `fetch failed: ${(e as Error).message}` };
	}
	if (!res.ok) return { kind: 'unknown', reason: `HTTP ${res.status}` };

	let data: unknown;
	try {
		data = await res.json();
	} catch {
		return { kind: 'unknown', reason: 'invalid JSON' };
	}

	if (!isSummary(data)) return { kind: 'unknown', reason: 'unexpected payload shape' };
	return { kind: 'ok', summary: data };
}

export function isSummary(v: unknown): v is Summary {
	if (typeof v !== 'object' || v === null) return false;
	const o = v as Record<string, unknown>;
	const s = o.status as Record<string, unknown> | undefined;
	return (
		typeof s === 'object'
		&& s !== null
		&& typeof s.indicator === 'string'
		&& typeof s.description === 'string'
		&& Array.isArray(o.components)
		&& Array.isArray(o.incidents)
	);
}

export function exitCodeFor(indicator: Indicator): 0 | 1 | 2 {
	switch (indicator) {
		case 'none':
			return 0;
		case 'minor':
			return 1;
		case 'major':
		case 'critical':
			return 2;
	}
}

export function emoji(indicator: Indicator): string {
	return indicator === 'none' ? 'up' : indicator === 'minor' ? 'degraded' : 'down';
}

// ─── Source A: downdetector via headless Chrome + CDP ────────────────────────

/** Locate a Chromium-family binary on $PATH. Returns null if none found. */
export async function findChrome(): Promise<string | null> {
	for (const name of CHROME_CANDIDATES) {
		const p = Bun.spawnSync(['which', name]);
		if (p.exitCode === 0 && p.stdout) {
			return new TextDecoder().decode(p.stdout).trim();
		}
	}
	return null;
}

// CDP / PogoConfig shape guards — reject unknown payloads at the boundary
// instead of trusting `as` casts.

function isTargetInfo(v: unknown): v is { webSocketDebuggerUrl: string } {
	if (typeof v !== 'object' || v === null) return false;
	const o = v as Record<string, unknown>;
	return typeof o.webSocketDebuggerUrl === 'string';
}

function isCdpMessage(v: unknown): v is { id: number } {
	if (typeof v !== 'object' || v === null) return false;
	const o = v as Record<string, unknown>;
	return typeof o.id === 'number';
}

function isCdpEvalResult(v: unknown): v is { result: { result: { value: string } } } {
	if (typeof v !== 'object' || v === null) return false;
	const o = v as Record<string, unknown>;
	if (typeof o.result !== 'object' || o.result === null) return false;
	const outer = o.result as Record<string, unknown>;
	if (typeof outer.result !== 'object' || outer.result === null) return false;
	const inner = outer.result as Record<string, unknown>;
	return typeof inner.value === 'string';
}

type PogoSnapshot = {
	title: string;
	pogo: { outage?: boolean } | null;
	h1: string | null;
};

function isPogoSnapshot(v: unknown): v is PogoSnapshot {
	if (typeof v !== 'object' || v === null) return false;
	const o = v as Record<string, unknown>;
	if (typeof o.title !== 'string') return false;
	if (o.h1 !== null && typeof o.h1 !== 'string') return false;
	if (o.pogo === null) return true;
	if (typeof o.pogo !== 'object') return false;
	const pogo = o.pogo as Record<string, unknown>;
	if (pogo.outage !== undefined && typeof pogo.outage !== 'boolean') return false;
	return true;
}

/**
 * Check downdetector (allestoringen.nl) via headless Chrome driven over CDP.
 *
 * The page sits behind a Cloudflare TLS-fingerprint challenge, so plain
 * `fetch` gets an interstitial. We spawn a real Chromium, let it solve the
 * challenge, then read `window.PogoConfig.outage` out of the SSR'd page.
 * Bounded by a 20s wall-clock deadline.
 */
export async function checkDowndetector(): Promise<Signal> {
	const chrome = await findChrome();
	if (!chrome) return { ok: false, error: 'no chromium/chrome binary found' };

	let userDataDir: string;
	try {
		userDataDir = mkdtempSync(join(tmpdir(), 'claude-down-'));
	} catch (e) {
		return { ok: false, error: `downdetector: mkdtemp failed: ${(e as Error).message}` };
	}

	const port = 9222 + Math.floor(Math.random() * 1000);
	let proc: ReturnType<typeof Bun.spawn> | null = null;

	try {
		proc = Bun.spawn(
			[
				chrome,
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
			{ stdout: 'ignore', stderr: 'ignore' },
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
			await Bun.sleep(100);
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
			if (typeof ev.data !== 'string') return;
			let parsed: unknown;
			try {
				parsed = JSON.parse(ev.data);
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
			await Bun.sleep(700);
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
		return { ok: false, error: `downdetector: ${(e as Error).message}` };
	} finally {
		proc?.kill();
		rmSync(userDataDir, { recursive: true, force: true });
	}
}
