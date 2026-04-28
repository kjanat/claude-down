import { Statuspage } from 'statuspage.io';

import { ANTHROPIC_STATUS_BASE } from '#claude-down/lib/constants.ts';
import type { Result } from '#claude-down/lib/types.ts';

/**
 * Creates a Statuspage client for the given base URL.
 *
 * @param baseUrl - The base URL of the Statuspage API.
 * @returns A configured Statuspage client instance.
 */
function createClient(baseUrl: string): Statuspage {
	const client = new Statuspage('anthropic');
	client.setApiUrl(baseUrl);
	return client;
}

/** Checks the status of Anthropic's services by querying their Statuspage API.
 *
 * @param baseUrl - Optional base URL for the Anthropic Statuspage API. Defaults to a predefined constant.
 * @returns A promise that resolves to a Result object containing either the summary of the status or an error reason.
 */
async function check(baseUrl = ANTHROPIC_STATUS_BASE): Promise<Result> {
	try {
		const client = createClient(baseUrl);
		const summary = await client.api.getSummary();
		return { kind: 'ok', summary };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return { kind: 'unknown', reason: msg };
	}
}

export { check as checkAnthropic, check as default };
