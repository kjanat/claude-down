import pkg from '#pkg' with { type: 'json' };
import { cli } from '@kjanat/dreamcli';

import {
	anthropicCommand,
	downdetectorCommand,
	statusCommand,
	webCommand,
} from '#claude-down/cli/commands';

const repoUrl = pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, '');

const claudeDown = cli(pkg.name)
	.version(pkg.version)
	.description(pkg.description)
	.links({ name: repoUrl, version: `${repoUrl}/releases/tag/v${pkg.version}` })
	.default(statusCommand)
	.command(anthropicCommand)
	.command(downdetectorCommand)
	.command(webCommand)
	.completions();

export { claudeDown };
