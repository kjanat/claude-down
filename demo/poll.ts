import { checkAnthropic } from '#claude-down/browser';

import { writeCache } from './cache.ts';
import { setPollingIcon } from './dom.ts';
import {
	DEFAULT_POLL_INTERVAL_MS,
	getHeaderPollInterval,
} from './poll-interval.ts';
import {
	renderComponents,
	renderError,
	renderHero,
	renderIncidents,
	setLastUpdated,
} from './render.ts';
import {
	getResultErrorMessage,
	getResultHeaders,
	isFailureResult,
	normalizeSummary,
} from './result.ts';
import { getErrorMessage } from './util.ts';

let pollTimer: number | undefined;
let pollInFlight = false;
let pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;

function setPollIntervalMs(ms: number): void {
	pollIntervalMs = ms;
}

function renderResult(result: unknown, lastUpdatedAt: Date): void {
	setLastUpdated(lastUpdatedAt);

	if (isFailureResult(result)) {
		renderError('Error', getResultErrorMessage(result));
		return;
	}

	const { status, incidents, components } = normalizeSummary(result);

	renderHero(status, incidents.length);
	renderIncidents(incidents);
	renderComponents(components);
}

async function fetchAndRender(): Promise<
	{ result: unknown; intervalMs: number }
> {
	const result: unknown = await checkAnthropic();
	renderResult(result, new Date());

	const headers = getResultHeaders(result);
	const intervalMs = headers === undefined
		? pollIntervalMs
		: getHeaderPollInterval(headers);

	return { result, intervalMs };
}

function clearPollTimer(): void {
	if (pollTimer === undefined) {
		return;
	}

	window.clearTimeout(pollTimer);
	pollTimer = undefined;
}

function stopPolling(): void {
	clearPollTimer();
	setPollingIcon(false);
}

function schedulePoll(delayMs: number = pollIntervalMs): void {
	clearPollTimer();

	if (document.visibilityState !== 'visible') {
		stopPolling();
		return;
	}

	setPollingIcon(true);

	pollTimer = window.setTimeout(() => {
		void poll();
	}, Math.max(0, delayMs));
}

function startPolling(): void {
	if (document.visibilityState !== 'visible') {
		stopPolling();
		return;
	}

	setPollingIcon(true);

	if (pollInFlight) {
		return;
	}

	void poll();
}

async function poll(): Promise<void> {
	clearPollTimer();

	if (document.visibilityState !== 'visible') {
		stopPolling();
		return;
	}

	if (pollInFlight) {
		return;
	}

	pollInFlight = true;
	setPollingIcon(true);

	try {
		const { result, intervalMs } = await fetchAndRender();
		pollIntervalMs = intervalMs;
		writeCache(result, intervalMs);
	} catch (error) {
		renderError('Exception', getErrorMessage(error));
	} finally {
		pollInFlight = false;
	}

	schedulePoll();
}

export {
	renderResult,
	schedulePoll,
	setPollIntervalMs,
	startPolling,
	stopPolling,
};
