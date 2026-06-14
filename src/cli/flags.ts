import { flag, ParseError } from '@kjanat/dreamcli';

import { type Model, models, sources } from '#claude-down/cli/model.ts';
import {
	ANTHROPIC_STATUS_BASE,
	CHROME_PATH_ENV,
} from '#claude-down/lib/constants.ts';

/** Suppresses all output; the process exit code conveys the status instead. */
const quietFlag = flag.boolean().alias('q').describe('Silent; exit code only');

/** Overrides the base URL used to reach Anthropic's Statuspage API. */
const anthropicStatusBaseFlag = flag
	.custom((raw) => new URL(String(raw)))
	.alias('anthropic-status-base', { hidden: true })
	.alias('base')
	.alias('b')
	.default(new URL(ANTHROPIC_STATUS_BASE))
	.env('CLAUDE_DOWN_ANTHROPIC_STATUS_BASE')
	.describe('Override Anthropic status page base URL');

/** Selects which data sources to query; defaults to all available sources. */
const sourceSelectionFlag = flag
	.array(flag.enum(sources))
	.alias('s')
	.default([...sources])
	.env('CLAUDE_DOWN_SOURCE')
	.env('CLAUDE_DOWN_SOURCES') // plural form for convenience
	.describe('Data source(s) to check');

/** Path to a Chrome/Chromium binary, overriding platform discovery. */
const chromeFlag = flag
	.string()
	.env(CHROME_PATH_ENV)
	.describe('Path to a Chrome/Chromium binary');

/** Model names as a lookup set for validation without widening assertions. */
const MODEL_NAMES: ReadonlySet<string> = new Set(models);

/** Type guard narrowing an arbitrary string to a known {@link Model}. */
function isModel(value: string): value is Model {
	return MODEL_NAMES.has(value);
}

/** Parses one `--model` token into the models it names, splitting on commas so
 * `--model opus,fable` works alongside repeated `--model opus --model fable`. */
function parseModelList(raw: unknown): readonly Model[] {
	const result: Model[] = [];
	for (const token of String(raw).split(',')) {
		const name = token.trim();
		if (name.length === 0) continue;
		if (!isModel(name)) {
			// Thrown ParseErrors are surfaced verbatim by dreamcli's flag parser,
			// matching the built-in enum error format.
			throw new ParseError(
				`Invalid value '${name}' for flag --model. Allowed: ${
					models.join(', ')
				}`,
				{
					code: 'INVALID_VALUE',
					details: {
						flag: 'model',
						input: '--model',
						value: name,
						allowed: models,
					},
				},
			);
		}
		result.push(name);
	}

	return result;
}

/** Restricts reported incidents/components to those naming the given model(s).
 * Accepts comma-separated values and/or repeated flags. */
const modelFlag = flag
	.array(flag.custom(parseModelList))
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

/** Shape of the flag values used to determine which models were selected.
 * `--model` resolves to one list per occurrence, flattened below. */
type ModelFlagValues =
	& { model: readonly (readonly Model[])[] }
	& Record<Model, boolean>;

/** Unions the `--model` lists with any enabled per-model convenience flags. */
function selectedModels(flags: ModelFlagValues): Set<Model> {
	const selected = new Set<Model>(flags.model.flat());
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
	parseModelList,
	quietFlag,
	selectedModels,
	sourceSelectionFlag,
};
