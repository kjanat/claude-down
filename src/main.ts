#!/usr/bin/env node

import { claudeDown } from '#claude-down/cli';
import { stdout } from 'node:process';

if (import.meta.main) {
	claudeDown.run({ help: { width: stdout.columns } });
}
