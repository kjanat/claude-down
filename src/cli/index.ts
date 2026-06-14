import { cli } from '@kjanat/dreamcli';
import pkg from 'claude-down/package.json' with { type: 'json' };

import {
	anthropicCommand,
	downdetectorCommand,
	statusCommand,
} from '#claude-down/cli/commands.ts';

const repoUrl = pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, '');

const claudeDown = cli(pkg.name)
	.version(pkg.version)
	.description(pkg.description)
	.links({ name: repoUrl, version: `${repoUrl}/releases/tag/v${pkg.version}` })
	.default(statusCommand)
	.command(anthropicCommand)
	.command(downdetectorCommand)
	.completions();

export { claudeDown };
