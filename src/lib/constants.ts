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

// Browser candidates to check for user agent retrieval, ordered by whatever.
const EDGE_CANDIDATES = ['microsoft-edge-stable', 'microsoft-edge'] as const;
const BRAVE_CANDIDATES = ['brave'] as const;
const CHROMIUM_CANDIDATES = ['chromium'] as const;
const CHROME_CANDIDATES = ['google-chrome-stable', 'google-chrome'] as const;

/** Ordered list of browser candidates to check for user agent retrieval. */
const BROWSER_CANDIDATES = [
	...CHROME_CANDIDATES,
	...CHROMIUM_CANDIDATES,
	...BRAVE_CANDIDATES,
	...EDGE_CANDIDATES,
] as const;

export { ANTHROPIC_STATUS_BASE, BROWSER_CANDIDATES, DOWNDETECTOR_URL, EXIT_CODES };
