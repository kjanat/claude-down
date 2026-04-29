import { cli } from '@kjanat/dreamcli';

import { anthropicCommand, downdetectorCommand, statusCommand } from '#claude-down/cli/commands.ts';

const claudeDown = cli('claude-down')
	.packageJson({ inferName: true })
	.command(statusCommand)
	.command(anthropicCommand)
	.command(downdetectorCommand)
	.completions();

export { claudeDown };
