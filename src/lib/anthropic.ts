import { Statuspage } from 'statuspage.io';

import { ANTHROPIC_STATUS_BASE } from './constants.ts';
import type { Result } from './types.ts';

function createClient(baseUrl: string): Statuspage {
	const client = new Statuspage('anthropic');
	client.setApiUrl(baseUrl);
	return client;
}

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

export default check;
