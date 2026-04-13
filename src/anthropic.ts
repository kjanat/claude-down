/**
 * Source B: status.claude.com — Anthropic's Statuspage.io summary.json.
 *
 * Fast, authoritative for tiered severity, but lags community detection by
 * minutes. We parse at the boundary via {@link isSummary} rather than trust
 * casts.
 */

import type { Result, Summary } from './types.ts';

export const STATUS_URL = 'https://status.claude.com/api/v2/summary.json';

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
