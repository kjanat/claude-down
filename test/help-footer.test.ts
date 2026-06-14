import { helpFooter, wantsHelp } from '#claude-down/cli/help-footer';
import { describe, expect, test } from 'bun:test';
import pkg from 'claude-down/package.json' with { type: 'json' };

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
});
