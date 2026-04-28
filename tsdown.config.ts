import { defineConfig, type UserConfig } from 'tsdown';

const defaultBuildOpts = {
	clean: true,
	dts: true,
	exports: false,
	format: 'es',
	platform: 'node',
	unbundle: false,
	minify: true,
} satisfies UserConfig;

export default defineConfig([
	{
		...defaultBuildOpts,
		entry: 'src/index.ts',
		dts: { entry: ['src/*.ts', '!src/main.ts', '!src/browser.ts'] },
		outDir: 'dist',
	},
	{
		...defaultBuildOpts,
		entry: { cli: 'src/main.ts' },
		dts: false,
		// exports: { bin: { 'claude-down': './src/main.ts' } },
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
