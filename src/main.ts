#!/usr/bin/env node

import { stdout } from 'node:process';

import { claudeDown } from './cli/commands.ts';

export { anthropicCommand, claudeDown, downdetectorCommand, statusCommand } from './cli/commands.ts';

if (import.meta.main) {
	claudeDown.run({ help: { width: stdout.columns } });
}
