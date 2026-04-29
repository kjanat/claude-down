import type { EXIT_CODES } from '#claude-down/lib/constants.ts';
import type { Summary } from 'statuspage.io';

/** Indicator represents the specific status code or condition that can be used to determine the state of a service. */
type Indicator = keyof typeof EXIT_CODES;
type AvailableIndicator = Exclude<Indicator, 'unavailable'>;

/** A signal represents the outcome of a status check, indicating whether the service is down and providing relevant information. */
type Signal =
	| { ok: true; down: true; reason: string }
	| { ok: true; down: false }
	| { ok: false; error: string };

/** The result of a status check, which can either be a successful summary or an unknown state with a reason. */
type Result =
	| { kind: 'ok'; summary: Summary }
	| { kind: 'unknown'; reason: string };

export type { AvailableIndicator, Indicator, Result, Signal, Summary };
