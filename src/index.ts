/**
 * claude-down — tell if Claude is down.
 *
 * Public library entry: two independent sources + formatting helpers.
 *
 *   A. downdetector (via allestoringen.nl) — see `./downdetector.ts`.
 *      Community/editor signal, tends to lead Anthropic by minutes.
 *   B. status.claude.com — see `./anthropic.ts`.
 *      Authoritative for tiered severity.
 *
 * The CLI in `./main.ts` OR's both sources into a single indicator.
 */

export * from './anthropic.ts';
export * from './downdetector.ts';
export * from './format.ts';
export * from './types.ts';
