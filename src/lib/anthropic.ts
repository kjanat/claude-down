import { Statuspage } from 'statuspage.io';

import { ANTHROPIC_STATUS_BASE } from './constants.ts';
import type { Result } from './types.ts';

const client = new Statuspage('anthropic');
client.setApiUrl(ANTHROPIC_STATUS_BASE);

async function check(): Promise<Result> {
	try {
		const summary = await client.api.getSummary();
		return { kind: 'ok', summary };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return { kind: 'unknown', reason: msg };
	}
}

export default check;
