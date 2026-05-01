import type { CdpSend } from '#claude-down/lib/downdetector/cdp.ts';
import { setTimeout } from 'node:timers/promises';

type PogoSnapshot = {
	title: string;
	pogo: { outage?: boolean } | null;
	h1: string | null;
};

type CdpEvalResult = {
	result: {
		result: {
			value: string;
		};
	};
};

function isCdpEvalResult(value: unknown): value is CdpEvalResult {
	return (
		value !== null
		&& typeof value === 'object'
		&& 'result' in value
		&& typeof value.result === 'object'
		&& value.result !== null
		&& 'result' in value.result
		&& typeof value.result.result === 'object'
		&& value.result.result !== null
		&& 'value' in value.result.result
		&& typeof value.result.result.value === 'string'
	);
}

function isPogoSnapshot(value: unknown): value is PogoSnapshot {
	if (typeof value !== 'object' || value === null) return false;
	if (!('title' in value) || typeof value.title !== 'string') return false;
	if ('h1' in value && value.h1 !== null && typeof value.h1 !== 'string') {
		return false;
	}
	if (!('pogo' in value)) return false;
	const { pogo } = value;

	if (pogo === null) return true;
	if (typeof pogo !== 'object') return false;

	if (
		'outage' in pogo && pogo.outage !== undefined
		&& typeof pogo.outage !== 'boolean'
	) return false;

	return true;
}
async function pollPogoSnapshot(
	send: CdpSend,
	timeoutMs: number,
): Promise<{ pogo: { outage?: boolean }; heading: string | null } | null> {
	await send('Runtime.enable');

	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const response = await send('Runtime.evaluate', {
			expression: `\
JSON.stringify({
	title: document.title,
	pogo: window.PogoConfig ?? null,
	h1: document.querySelector('h1')?.innerText ?? null,
})`,
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

		await setTimeout(700);
	}

	return null;
}

export { pollPogoSnapshot };
