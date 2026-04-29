import { command, type Out } from '@kjanat/dreamcli';
import { exit } from 'node:process';

import { anthropicStatusBaseFlag, quietFlag, sourceSelectionFlag } from '#claude-down/cli/flags.ts';
import { sourceLabels } from '#claude-down/cli/model.ts';
import type { StatusRow } from '#claude-down/cli/model.ts';
import { renderStatusRows } from '#claude-down/cli/render.ts';
import {
	checkAnthropicSource,
	checkDowndetectorSource,
	checkSources,
	sortRows,
	summarizeExitCode,
} from '#claude-down/cli/status.ts';

function finishStatus(rows: readonly StatusRow[], quiet: boolean, out: Out): void {
	if (quiet) {
		const exitCode = summarizeExitCode(rows);
		if (exitCode !== 0) exit(exitCode);
		return;
	}

	renderStatusRows(sortRows(rows), out);
}

const statusCommand = command('status')
	.description('Check Claude status across Anthropic and Downdetector')
	.example('status', 'Check all sources')
	.example('status --source anthropic', 'Check only Anthropic')
	.example('status --json', 'Emit machine-readable source rows')
	.flag('anthropicStatusBase', anthropicStatusBaseFlag)
	.flag('quiet', quietFlag)
	.flag('source', sourceSelectionFlag)
	.action(async ({ flags, out }) => {
		const rows = await checkSources(flags.source, flags.anthropicStatusBase);
		finishStatus(rows, flags.quiet, out);
	});

const anthropicCommand = command('anthropic')
	.description(`Check only ${sourceLabels.anthropic}`)
	.example('anthropic', `Check only ${sourceLabels.anthropic}`)
	.flag('anthropicStatusBase', anthropicStatusBaseFlag)
	.flag('quiet', quietFlag)
	.action(async ({ flags, out }) => {
		const row = await checkAnthropicSource(flags.anthropicStatusBase);
		finishStatus([row], flags.quiet, out);
	});

const downdetectorCommand = command('downdetector')
	.description(`Check only ${sourceLabels.downdetector}`)
	.example('downdetector', `Check only ${sourceLabels.downdetector}`)
	.flag('quiet', quietFlag)
	.action(async ({ flags, out }) => {
		const row = await checkDowndetectorSource();
		finishStatus([row], flags.quiet, out);
	});

export { anthropicCommand, downdetectorCommand, statusCommand };
