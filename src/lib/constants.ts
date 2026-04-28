/** Mapping of status levels to their corresponding exit codes. */
const EXIT_CODES = {
	'none': 0,
	'minor': 1,
	'major': 2,
	'critical': 2,
	'unavailable': 21,
} as const;

/** Base URL for Anthropic's status page API. */
const ANTHROPIC_STATUS_BASE = 'https://status.claude.com';
/** URL for Claude AI's status page on Downdetector. */
const DOWNDETECTOR_URL = 'https://downdetector.com/status/claude-ai/';

/** Executable names to probe via `which` when locating a Chromium-family binary. */
const BROWSER_CANDIDATES = [
	'google-chrome-stable',
	'google-chrome',
	'chromium',
	'brave',
	'microsoft-edge-stable',
	'microsoft-edge',
] as const;

export { ANTHROPIC_STATUS_BASE, BROWSER_CANDIDATES, DOWNDETECTOR_URL, EXIT_CODES };
