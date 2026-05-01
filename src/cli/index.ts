import { cli } from '@kjanat/dreamcli';
import pkg from 'claude-down/package.json' with { type: 'json' };

import { anthropicCommand, downdetectorCommand, statusCommand } from '#claude-down/cli/commands.ts';

const claudeDown = cli(pkg.name)
	.version(pkg.version)
	.description(pkg.description)
	.command(statusCommand)
	.command(anthropicCommand)
	.command(downdetectorCommand)
	.completions();

export { claudeDown };
