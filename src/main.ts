#!/usr/bin/env node

import { claudeDown } from '#claude-down/cli';
import { createNodeAdapter } from '@kjanat/dreamcli/runtime';
import process, { stdout } from 'node:process';

if (import.meta.main) {
	const adapter = createNodeAdapter();
	claudeDown.run({
		help: { width: stdout.columns },
		// A successful command resolves to exit code 0 in dreamcli; honor any
		// status-derived process.exitCode the action set instead of forcing 0.
		adapter: {
			...adapter,
			exit: (code) =>
				adapter.exit(code !== 0 ? code : Number(process.exitCode ?? 0)),
		},
	});
}
