/**
 * claude-down — browser-safe entry point.
 *
 * Only includes sources that work in the browser (Anthropic Statuspage).
 * Excludes Downdetector, as it requires a local Chromium binary.
 */

export { checkAnthropic, fetchSummary, isSummary, STATUS_URL } from '#claude-down/sources/anthropic.ts';
export * from '#claude-down/types.ts';
