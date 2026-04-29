import { flag } from '@kjanat/dreamcli';

import { sources } from '#claude-down/cli/model.ts';
import { ANTHROPIC_STATUS_BASE } from '#claude-down/lib/constants.ts';

/** Suppresses all output; the process exit code conveys the status instead. */
const quietFlag = flag.boolean().alias('q').describe('Silent; exit code only');

/** Overrides the base URL used to reach Anthropic's Statuspage API. */
const anthropicStatusBaseFlag = flag
	.string()
	.default(ANTHROPIC_STATUS_BASE)
	.env('CLAUDE_DOWN_ANTHROPIC_STATUS_BASE')
	.describe('Override Anthropic status page base URL');

/** Selects which data sources to query; defaults to all available sources. */
const sourceSelectionFlag = flag
	.array(flag.enum(sources))
	.default([...sources])
	.alias('s')
	.describe('Data source(s) to check');

export { anthropicStatusBaseFlag, quietFlag, sourceSelectionFlag };
