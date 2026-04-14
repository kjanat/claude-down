import { defineConfig, type UserConfig } from 'tsdown';

const defaultBuildOpts = {
	clean: true,
	dts: true,
	exports: true,
	format: 'es',
	platform: 'node',
	unbundle: true,
	minify: 'dce-only',
} satisfies UserConfig;

export default defineConfig([
	{
		...defaultBuildOpts,
		entry: 'src/index.ts',
		dts: { entry: ['src/*.ts', '!src/main.ts', '!src/browser.ts'] },
		exports: true,
		outDir: 'dist',
	},
	{
		...defaultBuildOpts,
		entry: { cli: 'src/main.ts' },
		dts: false,
		exports: { bin: { 'claude-down': './src/main.ts' } },
		outDir: 'dist/bin',
		unbundle: false,
		minify: true,
	},
	{
		...defaultBuildOpts,
		entry: { browser: './src/browser.ts' },
		dts: { entry: ['src/browser.ts'] },
		deps: { alwaysBundle: ['statuspage.io'] },
		exports: true,
		platform: 'browser',
		outDir: 'dist/browser',
		unbundle: false,
		minify: true,
	},
]);
