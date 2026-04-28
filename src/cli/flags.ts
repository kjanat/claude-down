import { flag } from '@kjanat/dreamcli';

import { sources } from '#claude-down/cli/status.ts';
import { ANTHROPIC_STATUS_BASE } from '#claude-down/lib/constants.ts';

const quietFlag = flag.boolean().alias('q').describe('Silent; exit code only');

const anthropicStatusBaseFlag = flag
	.string()
	.default(ANTHROPIC_STATUS_BASE)
	.env('CLAUDE_DOWN_ANTHROPIC_STATUS_BASE')
	.describe('Override Anthropic status page base URL');

const sourceSelectionFlag = flag
	.array(flag.enum(sources))
	.default([...sources])
	.alias('s')
	.describe('Data source(s) to check');

export { anthropicStatusBaseFlag, quietFlag, sourceSelectionFlag };
