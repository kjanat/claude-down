import { flag } from '@kjanat/dreamcli';

import { type Model, models, sources } from '#claude-down/cli/model';
import {
	ANTHROPIC_STATUS_BASE,
	CHROME_PATH_ENV,
} from '#claude-down/lib/constants';

/** Overrides the base URL used to reach Anthropic's Statuspage API. */
const anthropicStatusBaseFlag = flag
	.url()
	.alias('anthropic-status-base', { hidden: true })
	.alias('base')
	.alias('b')
	.default(new URL(ANTHROPIC_STATUS_BASE))
	.env('CLAUDE_DOWN_ANTHROPIC_STATUS_BASE')
	.describe('Override Anthropic status page base URL');

/** Selects which data sources to query; defaults to all available sources.
 * Accepts comma-separated values and/or repeated flags, deduplicated so
 * `--source anthropic,anthropic` checks Anthropic once. */
const sourceSelectionFlag = flag
	.array(flag.enum(sources))
	.separator(',')
	.unique()
	.alias('s')
	.default([...sources])
	// dreamcli binds one env var per flag (each .env() call replaces the
	// previous), so only the plural spelling — the one help has always
	// advertised — is supported.
	.env('CLAUDE_DOWN_SOURCES')
	.describe('Data source(s) to check');

/** Path to a Chrome/Chromium binary, overriding platform discovery. */
const chromeFlag = flag
	.path()
	.env(CHROME_PATH_ENV)
	.describe('Path to a Chrome/Chromium binary');

/** Restricts reported incidents/components to those naming the given model(s).
 * Accepts comma-separated values and/or repeated flags. */
const modelFlag = flag
	.array(flag.enum(models))
	.separator(',')
	.unique()
	.alias('m')
	.describe('Only report incidents/components mentioning these model(s)');

/** Per-model convenience flags, e.g. `--opus` is shorthand for `--model opus`. */
const modelConvenienceFlags = {
	opus: flag.boolean().describe('Shortcut for --model opus'),
	haiku: flag.boolean().describe('Shortcut for --model haiku'),
	sonnet: flag.boolean().describe('Shortcut for --model sonnet'),
	mythos: flag.boolean().describe('Shortcut for --model mythos'),
	fable: flag.boolean().describe('Shortcut for --model fable'),
} as const;

/** Shape of the flag values used to determine which models were selected. */
type ModelFlagValues =
	& { model: readonly Model[] }
	& Record<
		Model,
		boolean
	>;

/** Unions the `--model` selection with any enabled per-model convenience
 * flags. */
function selectedModels(flags: ModelFlagValues): Set<Model> {
	const selected = new Set<Model>(flags.model);
	for (const model of models) {
		if (flags[model]) selected.add(model);
	}

	return selected;
}

export {
	anthropicStatusBaseFlag,
	chromeFlag,
	modelConvenienceFlags,
	modelFlag,
	selectedModels,
	sourceSelectionFlag,
};
