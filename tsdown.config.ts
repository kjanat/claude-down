import { defineConfig, type UserConfig } from 'tsdown';

const defaultBuildOpts = {
	clean: true,
	dts: true,
	exports: true,
	format: 'es',
	platform: 'node',
} satisfies UserConfig;

export default defineConfig([
	{
		...defaultBuildOpts,
		entry: ['src/index.ts', { cli: 'src/main.ts' }],
		dts: {
			entry: ['src/*.ts', '!src/main.ts'],
		},
		exports: {
			enabled: true,
			exclude: ['cli', 'main'],
			bin: true,
		},
	},
	{
		...defaultBuildOpts,
		dts: false,
		entry: { browser: './src/browser.ts' },
		platform: 'browser',
	},
]);
