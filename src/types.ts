import type { Summary } from 'statuspage.io';

import type { EXIT_CODES } from '#claude-down/constants.ts';

type Indicator = keyof typeof EXIT_CODES;

type Signal =
	| { ok: true; down: true; reason: string }
	| { ok: true; down: false }
	| { ok: false; error: string };

type Result =
	| { kind: 'ok'; summary: Summary }
	| { kind: 'unknown'; reason: string };

export type { Indicator, Result, Signal, Summary };
