import { cli, command } from '@kjanat/dreamcli';

import { quietFlag, sourceSelectionFlag } from './flags.ts';
import { checkSource, checkSources, renderStatusResult, sortRows, sourceLabels, summarizeExitCode } from './status.ts';

const statusCommand = command('status')
	.description('Check Claude status across Anthropic and Downdetector')
	.example('status', 'Check all sources')
	.example('status --source anthropic', 'Check only Anthropic')
	.example('status --json', 'Emit machine-readable source rows')
	.flag('quiet', quietFlag)
	.flag('source', sourceSelectionFlag)
	.action(async ({ flags, out }) => {
		const results = await checkSources(flags.source);
		renderStatusResult(flags.quiet ? summarizeExitCode(results) : sortRows(results), out);
	});

const anthropicCommand = command('anthropic')
	.description(`Check only ${sourceLabels.anthropic}`)
	.example('anthropic', `Check only ${sourceLabels.anthropic}`)
	.flag('quiet', quietFlag)
	.action(async ({ flags, out }) => {
		const result = await checkSource('anthropic');
		renderStatusResult(flags.quiet ? result.exitCode : [result.row], out);
	});

const downdetectorCommand = command('downdetector')
	.description(`Check only ${sourceLabels.downdetector}`)
	.example('downdetector', `Check only ${sourceLabels.downdetector}`)
	.flag('quiet', quietFlag)
	.action(async ({ flags, out }) => {
		const result = await checkSource('downdetector');
		renderStatusResult(flags.quiet ? result.exitCode : [result.row], out);
	});

const claudeDown = cli('claude-down')
	.packageJson({ inferName: true })
	.default(statusCommand)
	.command(anthropicCommand)
	.command(downdetectorCommand)
	.completions();

export { anthropicCommand, claudeDown, downdetectorCommand, statusCommand };
