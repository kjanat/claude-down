import pkg from '#pkg' with { type: 'json' };
import { cli, packageRepositoryUrl } from 'dreamcli';

import {
	anthropicCommand,
	apiCommand,
	downdetectorCommand,
	statusCommand,
	webCommand,
} from '#claude-down/cli/commands';

const repoUrl = packageRepositoryUrl(pkg, { require: true });

const claudeDown = cli(pkg.name)
	.version(pkg.version)
	.description(pkg.description)
	.links({ name: repoUrl, version: `${repoUrl}/releases/tag/v${pkg.version}` })
	.default(statusCommand, { route: true })
	.command(apiCommand)
	.command(anthropicCommand)
	.command(downdetectorCommand)
	.command(webCommand)
	.completions();

export { claudeDown };
