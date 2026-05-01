import { ANTHROPIC_STATUS_BASE } from '#claude-down/lib/constants.ts';
import type { Result, Summary } from '#claude-down/lib/types.ts';

const SUMMARY_PATH = '/api/v2/summary.json';

async function getErrorReason(response: Response): Promise<string> {
	try {
		const body = await response.text();
		return `Request failed with status code ${response.status}${
			body.length > 0 ? `: ${body}` : ''
		}`;
	} catch {
		return `Request failed with status code ${response.status}: ${response.statusText}`;
	}
}

/** Checks the status of Anthropic's services by querying their Statuspage API.
 *
 * @param baseUrl - Optional base URL for the Anthropic Statuspage API. Defaults to a predefined constant.
 * @returns A promise that resolves to a Result object containing either the summary of the status or an error reason.
 */
async function check(baseUrl: string = ANTHROPIC_STATUS_BASE): Promise<Result> {
	try {
		const response = await fetch(new URL(SUMMARY_PATH, baseUrl));
		if (!response.ok) {
			return {
				headers: response.headers,
				kind: 'unknown',
				reason: await getErrorReason(response),
			};
		}

		const summary: Summary = await response.json();
		return { headers: response.headers, kind: 'ok', summary };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return { kind: 'unknown', reason: msg };
	}
}

export { check as checkAnthropic, check as default };
