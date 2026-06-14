import { flag, ParseError } from '@kjanat/dreamcli';

import {
	type Model,
	models,
	type Source,
	sources,
} from '#claude-down/cli/model.ts';
import {
	ANTHROPIC_STATUS_BASE,
	CHROME_PATH_ENV,
} from '#claude-down/lib/constants.ts';

/** Builds a flag parser that splits one comma-separated token into validated
 * enum members, so `--flag a,b` works alongside repeated `--flag a --flag b`.
 * Thrown ParseErrors are surfaced verbatim by dreamcli's flag parser, matching
 * its built-in enum error format. */
function csvEnumParser<T extends string>(
	allowed: readonly T[],
	flagName: string,
): (raw: unknown) => readonly T[] {
	return (raw: unknown): readonly T[] => {
		const result: T[] = [];
		for (const token of String(raw).split(',')) {
			const name = token.trim();
			if (name.length === 0) continue;
			// `find` yields the typed member (or undefined) without a cast.
			const match = allowed.find((value) => value === name);
			if (match === undefined) {
				throw new ParseError(
					`Invalid value '${name}' for flag --${flagName}. Allowed: ${
						allowed.join(', ')
					}`,
					{
						code: 'INVALID_VALUE',
						details: {
							flag: flagName,
							input: `--${flagName}`,
							value: name,
							allowed,
						},
					},
				);
			}
			result.push(match);
		}

		return result;
	};
}

/** Parses one `--model` token into the models it names (comma-separated). */
const parseModelList = csvEnumParser(models, 'model');

/** Parses one `--source` token into the sources it names (comma-separated). */
const parseSourceList = csvEnumParser(sources, 'source');

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

/** Selects which data sources to query; defaults to all available sources.
 * Accepts comma-separated values and/or repeated flags. */
const sourceSelectionFlag = flag
	.array(flag.custom(parseSourceList))
	.alias('s')
	.default([[...sources]])
	.env('CLAUDE_DOWN_SOURCE')
	.env('CLAUDE_DOWN_SOURCES') // plural form for convenience
	.describe('Data source(s) to check');

/** Path to a Chrome/Chromium binary, overriding platform discovery. */
const chromeFlag = flag
	.string()
	.env(CHROME_PATH_ENV)
	.describe('Path to a Chrome/Chromium binary');

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

/** Flattens the per-occurrence `--source` lists into the sources to query. */
function selectedSources(
	source: readonly (readonly Source[])[],
): readonly Source[] {
	return source.flat();
}

export {
	anthropicStatusBaseFlag,
	chromeFlag,
	modelConvenienceFlags,
	modelFlag,
	parseModelList,
	parseSourceList,
	quietFlag,
	selectedModels,
	selectedSources,
	sourceSelectionFlag,
};
