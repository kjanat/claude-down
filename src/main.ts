#!/usr/bin/env node

import { claudeDown } from '#claude-down/cli';
import { helpFooter, wantsHelp } from '#claude-down/cli/help-footer';
import pkg from '#pkg' with { type: 'json' };
import { resolveRenderContext } from '@kjanat/dreamcli';
import { createNodeAdapter } from '@kjanat/dreamcli/runtime';
import { argv, env } from 'node:process';

if (import.meta.main) {
	const adapter = createNodeAdapter();
	// dreamcli has no help-footer hook, so detect a help invocation up front and
	// append a pointer to the browser page once help has rendered. The footer's
	// hyperlink follows the same OSC 8 gate the framework itself uses
	// (NO_HYPERLINKS/FORCE_HYPERLINKS, --no-hyperlinks/--hyperlinks, TTY).
	const args = argv.slice(2);
	const showFooter = wantsHelp(args);
	const render = resolveRenderContext(args, { isTTY: adapter.isTTY, env });
	claudeDown.run({
		adapter: {
			...adapter,
			exit: (code) => {
				if (showFooter) {
					adapter.stdout(helpFooter(pkg.homepage, render.isHyperlinkSupported));
				}
				return adapter.exit(code);
			},
		},
	});
}
