import { helpFooter, wantsHelp } from '#claude-down/cli/help-footer';
import pkg from '#pkg' with { type: 'json' };
import { osc8 } from '@kjanat/dreamcli';
import { describe, expect, test } from 'bun:test';

describe('help footer', () => {
	test('detects help flags anywhere in argv', () => {
		expect(wantsHelp(['--help'])).toBe(true);
		expect(wantsHelp(['-h'])).toBe(true);
		expect(wantsHelp(['status', '--help'])).toBe(true);
		expect(wantsHelp(['status', '--source', 'anthropic', '-h'])).toBe(true);
	});

	test('ignores non-help argv', () => {
		expect(wantsHelp([])).toBe(false);
		expect(wantsHelp(['status'])).toBe(false);
		expect(wantsHelp(['status', '--opus'])).toBe(false);
	});

	test('footer points at the homepage on its own trailing line', () => {
		const footer = helpFooter(pkg.homepage);
		expect(footer.startsWith('\n')).toBe(true);
		expect(footer.endsWith('\n')).toBe(true);
		expect(footer).toContain(pkg.homepage);
	});

	test('plain footer carries no escape sequences', () => {
		expect(helpFooter(pkg.homepage)).not.toContain('\x1b]8;;');
	});

	test('hyperlink footer wraps the URL in dreamcli osc8', () => {
		const footer = helpFooter(pkg.homepage, true);
		// osc8's link text defaults to the target itself.
		expect(footer).toContain(osc8(pkg.homepage));
		// dreamcli delegates to ansispeck's hyperlink constructor, which
		// terminates the OSC 8 sequence with ST (ESC \).
		expect(footer).toContain(
			`\x1b]8;;${pkg.homepage}\x1b\\${pkg.homepage}\x1b]8;;\x1b\\`,
		);
	});
});
