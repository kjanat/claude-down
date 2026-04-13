/**
 * claude-down — tell if Claude is down.
 *
 * Public library entry: two independent sources + formatting helpers.
 *
 *   A. downdetector (via allestoringen.nl) — see `./sources/downdetector.ts`.\
 *      Community/editor signal, tends to lead Anthropic by minutes.
 *   B. status.claude.com — see `./sources/anthropic.ts`.\
 *      Authoritative for tiered severity.
 *
 * The CLI in `./main.ts` OR's both sources into a single indicator.
 */

export * from '#claude-down/sources';
export * from '#claude-down/types.ts';
