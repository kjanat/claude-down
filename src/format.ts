/**
 * Pure presentation helpers: `severity → exit code, severity → label`.
 */

import type { Indicator } from '#claude-down/types.ts';

export function exitCodeFor(indicator: Indicator) {
	switch (indicator) {
		case 'none':
			return 0;
		case 'minor':
			return 1;
		case 'major':
		case 'critical':
			return 2;
	}
}

export function emoji(indicator: Indicator) {
	return indicator === 'none' ? 'up' : indicator === 'minor' ? 'degraded' : 'down';
}
