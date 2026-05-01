import { isRecord } from './util.ts';

const CACHE_KEY = 'claude-down:last-summary';

interface CachedEntry {
	intervalMs: number;
	result: unknown;
	savedAt: number;
}

function readCache(): CachedEntry | null {
	try {
		const raw = sessionStorage.getItem(CACHE_KEY);
		if (raw === null) {
			return null;
		}

		const parsed: unknown = JSON.parse(raw);
		if (!isRecord(parsed)) {
			return null;
		}

		const { savedAt, intervalMs, result } = parsed;
		if (typeof savedAt !== 'number' || typeof intervalMs !== 'number') {
			return null;
		}

		return { savedAt, intervalMs, result };
	} catch {
		return null;
	}
}

function writeCache(result: unknown, intervalMs: number): void {
	try {
		sessionStorage.setItem(
			CACHE_KEY,
			JSON.stringify({ savedAt: Date.now(), intervalMs, result }),
		);
	} catch {
		// sessionStorage disabled or quota exceeded — drop the cache silently
	}
}

export type { CachedEntry };
export { readCache, writeCache };
