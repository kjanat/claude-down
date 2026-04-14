const EXIT_CODES = {
	'none': 0,
	'minor': 1,
	'major': 2,
	'critical': 2,
	'unavailable': 3,
} as const;

const ANTHROPIC_STATUS_BASE = 'https://status.claude.com';

const DOWNDETECTOR_URL = 'https://downdetector.com/status/claude-ai/';

const CHROME_CANDIDATES = ['chromium', 'google-chrome-stable', 'google-chrome', 'brave'] as const;

export { ANTHROPIC_STATUS_BASE, CHROME_CANDIDATES, DOWNDETECTOR_URL, EXIT_CODES };
