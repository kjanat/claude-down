import { readCache } from './cache.ts';
import {
	renderResult,
	schedulePoll,
	setPollIntervalMs,
	startPolling,
	stopPolling,
} from './poll.ts';

function bootstrap(): void {
	const cached = readCache();

	if (cached !== null) {
		const elapsed = Date.now() - cached.savedAt;

		if (elapsed >= 0 && elapsed < cached.intervalMs) {
			renderResult(cached.result, new Date(cached.savedAt));
			setPollIntervalMs(cached.intervalMs);
			schedulePoll(cached.intervalMs - elapsed);
			return;
		}
	}

	startPolling();
}

document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'visible') {
		startPolling();
	} else {
		stopPolling();
	}
});

bootstrap();
