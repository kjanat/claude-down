#!/usr/bin/env node

import { anthropicCommand, downdetectorCommand, statusCommand } from '#claude-down/cli/commands.ts';
import { cli } from '@kjanat/dreamcli';
import { stdout } from 'node:process';

/**
 * The main CLI instance for the `claude-down` application.
 *
 * It registers the available commands and handles execution.
 */
export const claudeDown = cli('claude-down')
	.packageJson({ inferName: true })
	.command(statusCommand)
	.command(anthropicCommand)
	.command(downdetectorCommand)
	.completions();

if (import.meta.main) {
	claudeDown.run({ help: { width: stdout.columns } });
}
