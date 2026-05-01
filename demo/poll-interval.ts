const DEFAULT_POLL_INTERVAL_MS = 10_000;
const MAX_POLL_INTERVAL_MS = 60_000;
const MIN_POLL_INTERVAL_MS = 3_000;

function clampPollInterval(ms: number): number {
	return Math.min(Math.max(ms, MIN_POLL_INTERVAL_MS), MAX_POLL_INTERVAL_MS);
}

function getCacheDirectiveSeconds(
	cacheControl: string | null,
	directiveName: string,
): number | null {
	if (cacheControl === null) {
		return null;
	}

	for (const directive of cacheControl.split(',')) {
		const [name, rawValue] = directive.trim().split('=');

		if (name === undefined || rawValue === undefined) {
			continue;
		}

		if (name.toLowerCase() !== directiveName) {
			continue;
		}

		const seconds = Number(rawValue.trim().replace(/^"|"$/g, ''));

		if (Number.isFinite(seconds) && seconds > 0) {
			return seconds;
		}
	}

	return null;
}

function getHeaderPollInterval(headers: Headers): number {
	const cacheControl = headers.get('cache-control');

	const seconds = getCacheDirectiveSeconds(cacheControl, 's-maxage')
		?? getCacheDirectiveSeconds(cacheControl, 'max-age');

	if (seconds === null) {
		return DEFAULT_POLL_INTERVAL_MS;
	}

	return clampPollInterval(seconds * 1000);
}

export { DEFAULT_POLL_INTERVAL_MS, getHeaderPollInterval };
