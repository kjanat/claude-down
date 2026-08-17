import { homepage as url } from '#pkg' with { type: 'json' };
import { describe, expect, test } from 'bun:test';

import { defaultBrowserOpenCommand } from '#claude-down/lib/open-url';

describe(defaultBrowserOpenCommand.name, () => {
	test('uses open on macOS', () => {
		expect(defaultBrowserOpenCommand(url, 'darwin')).toEqual({
			command: 'open',
			args: [url],
		});
	});

	test('uses start through cmd on Windows', () => {
		expect(defaultBrowserOpenCommand(url, 'win32')).toEqual({
			command: 'cmd',
			args: ['/c', 'start', '', url],
		});
	});

	test('uses xdg-open elsewhere', () => {
		expect(defaultBrowserOpenCommand(url, 'linux')).toEqual({
			command: 'xdg-open',
			args: [url],
		});
	});
});
