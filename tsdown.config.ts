import { defineConfig, type UserConfig } from 'tsdown';

const defaultBuildOpts = {
	clean: true,
	dts: true,
	exports: false,
	format: 'es',
	unbundle: false,
	minify: true,
} satisfies UserConfig;

export default defineConfig([
	{
		...defaultBuildOpts,
		entry: 'src/index.ts',
		dts: { entry: ['src/*.ts', '!src/main.ts', '!src/browser.ts'] },
		platform: 'node',
		outDir: 'dist',
	},
	{
		...defaultBuildOpts,
		entry: { cli: 'src/main.ts' },
		dts: false,
		// exports: { bin: { 'claude-down': './src/main.ts' } },
		platform: 'node',
		outDir: 'dist/bin',
	},
	{
		...defaultBuildOpts,
		entry: { browser: './src/browser.ts' },
		dts: { entry: ['src/browser.ts'] },
		// deps: { alwaysBundle: ['statuspage.io'], neverBundle: ['@kjanat/dreamcli'] },
		platform: 'browser',
		outDir: 'dist/browser',
	},
]);
