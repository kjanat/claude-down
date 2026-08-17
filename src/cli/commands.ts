import type { CommandBuilder, Out } from 'dreamcli';
import { arg, command } from 'dreamcli';

import {
	fetchStatusApiResource,
	statusApiResourceList,
	statusApiResources,
} from '#claude-down/cli/api';
import {
	anthropicStatusBaseFlag,
	chromeFlag,
	modelConvenienceFlags,
	modelFlag,
	selectedModels,
	sourceSelectionFlag,
} from '#claude-down/cli/flags';
import { type Model, type Source, sourceLabels } from '#claude-down/cli/model';
import type { StatusRow } from '#claude-down/cli/model';
import {
	renderPageFooter,
	renderStatusRow,
	renderStatusRows,
} from '#claude-down/cli/render';
import {
	checkAnthropicSource,
	checkDowndetectorSource,
	checkSource,
	filterAnthropicByModels,
	sortRows,
	summarizeExitCode,
} from '#claude-down/cli/status';
import { openUrlInDefaultBrowser } from '#claude-down/lib/open-url';
import pkg from '#pkg' with { type: 'json' };

/** A source paired with the deferred work that checks it. */
type SourceTask = Readonly<{
	source: Source;
	run: () => Promise<StatusRow>;
}>;

type UrlOpener = (url: string) => Promise<void> | void;

/**
 * Whether the run is in quiet mode ("silent; exit code only"). dreamcli
 * intercepts the global `--quiet`/`-q` at the CLI root and records it as the
 * output channel's verbosity, but the `Out` interface doesn't expose it, so
 * read the policy snapshot off the concrete channel. Hand-rolled `Out` stubs
 * without a policy count as not quiet.
 */
function isQuiet(out: Out): boolean {
	const { policy } = out as { policy?: { verbosity?: string } };
	return policy?.verbosity === 'quiet';
}

/** Registers `--model` and every per-model convenience flag in one place, so
 * the set can't drift between the `status` and `anthropic` commands. Takes a
 * still-flagless builder because dreamcli's `.flag()` name-clash guard
 * (`Exclude<N, keyof F>`) can't be proven for an open generic `F`. */
function withModelFlags(cmd: CommandBuilder) {
	return cmd
		.flag('model', modelFlag)
		.flag('opus', modelConvenienceFlags.opus)
		.flag('haiku', modelConvenienceFlags.haiku)
		.flag('sonnet', modelConvenienceFlags.sonnet)
		.flag('mythos', modelConvenienceFlags.mythos)
		.flag('fable', modelConvenienceFlags.fable);
}

/**
 * Drives a set of source checks and renders the result. In an interactive
 * terminal each row is streamed in as it resolves behind a spinner; otherwise
 * the rows are collected and rendered in one batch (JSON, or nothing when
 * quiet). The status-derived exit code is always set.
 */
async function runStatus(
	tasks: readonly SourceTask[],
	selected: ReadonlySet<Model>,
	out: Out,
): Promise<void> {
	// Spinners and per-row streaming only make sense in a real terminal: JSON
	// must stay a single array on stdout, non-TTY output is machine-bound, and
	// quiet suppresses decoration entirely.
	const quiet = isQuiet(out);
	if (out.isTTY && !out.jsonMode && !quiet) {
		const rows = await streamStatus(tasks, selected, out);
		out.setExitCode(summarizeExitCode(rows));
		return;
	}

	const rows = applyModelFilter(
		await Promise.all(tasks.map((task) => task.run())),
		selected,
	);
	if (!quiet) {
		renderStatusRows(sortRows(rows), out);
	}

	out.setExitCode(summarizeExitCode(rows));
}

/** Spinner label naming the sources still being checked. */
function checkingText(pending: ReadonlySet<Source>): string {
	return `Checking ${
		[...pending]
			.map((source) => sourceLabels[source])
			.join(', ')
	}…`;
}

/**
 * Runs the checks concurrently and prints each result the instant it lands,
 * keeping a spinner alive for whatever is still outstanding. dreamcli allows
 * only one active spinner, so we stop it to clear the line before printing a
 * row and start a fresh one (with the shrunken source list) if work remains.
 */
async function streamStatus(
	tasks: readonly SourceTask[],
	selected: ReadonlySet<Model>,
	out: Out,
): Promise<StatusRow[]> {
	const pending = new Set<Source>(tasks.map((task) => task.source));
	const collected: StatusRow[] = [];
	const inFlight = new Map(
		tasks.map(
			(task, index) =>
				[
					index,
					task.run().then((row) => ({ source: task.source, row })),
				] as const,
		),
	);

	let spinner = out.spinner(checkingText(pending));
	let renderedRows = 0;
	try {
		while (inFlight.size > 0) {
			const settled = await Promise.race(
				[...inFlight].map(([index, ready]) =>
					ready.then((value) => ({ index, ...value }))
				),
			);
			inFlight.delete(settled.index);
			pending.delete(settled.source);

			const row = filterAnthropicByModels(settled.row, selected);
			collected.push(row);

			spinner.stop();
			renderStatusRow(row, out, { leadingBlank: renderedRows > 0 });
			renderedRows += 1;
			if (pending.size > 0) {
				spinner = out.spinner(checkingText(pending));
			}
		}
	} catch (error: unknown) {
		// Restore the cursor/clear the line before the error propagates.
		spinner.stop();
		throw error;
	}

	renderPageFooter(out);
	return collected;
}

function applyModelFilter(
	rows: readonly StatusRow[],
	selected: ReadonlySet<Model>,
): readonly StatusRow[] {
	if (selected.size === 0) return rows;
	return rows.map((row) => filterAnthropicByModels(row, selected));
}

const statusCommand = withModelFlags(
	command('status')
		.description('Check Claude status across Anthropic and Downdetector')
		.example((meta) => `${meta.name} status`, 'Check all sources')
		.example(
			(meta) => `${meta.name} status --source anthropic`,
			'Check only Anthropic',
		)
		.example(
			(meta) => `${meta.name} status --opus`,
			'Only report incidents mentioning Opus',
		)
		.example(
			(meta) => `${meta.name} status --json`,
			'Emit machine-readable source rows',
		),
)
	.flag('anthropicStatusBase', anthropicStatusBaseFlag)
	.flag('chrome', chromeFlag)
	.flag('source', sourceSelectionFlag)
	.action(async ({ flags, out }) => {
		const { source, anthropicStatusBase, chrome } = flags;
		const tasks = source.map(
			(src): SourceTask => ({
				source: src,
				run: () => checkSource(src, anthropicStatusBase, chrome),
			}),
		);
		await runStatus(tasks, selectedModels(flags), out);
	});

const anthropicCommand = withModelFlags(
	command('anthropic')
		.description(`Check only ${sourceLabels.anthropic}`)
		.example(
			(meta) => `${meta.name} anthropic`,
			`Check only ${sourceLabels.anthropic}`,
		)
		.example(
			(meta) => `${meta.name} anthropic --model opus`,
			'Only report incidents mentioning Opus',
		),
)
	.flag('anthropicStatusBase', anthropicStatusBaseFlag)
	.action(async ({ flags, out }) => {
		const tasks: SourceTask[] = [
			{
				source: 'anthropic',
				run: () => checkAnthropicSource(flags.anthropicStatusBase),
			},
		];
		await runStatus(tasks, selectedModels(flags), out);
	});

const downdetectorCommand = command('downdetector')
	.description(`Check only ${sourceLabels.downdetector}`)
	.example(
		(meta) => `${meta.name} downdetector`,
		`Check only ${sourceLabels.downdetector}`,
	)
	.flag('chrome', chromeFlag)
	.action(async ({ flags, out }) => {
		const tasks: SourceTask[] = [
			{
				source: 'downdetector',
				run: () => checkDowndetectorSource(flags.chrome),
			},
		];
		await runStatus(tasks, new Set(), out);
	});

const apiListCommand = command('list')
	.alias('ls')
	.description('List available Status API endpoints (alias: ls)')
	.action(({ out }) => {
		const endpoints = statusApiResourceList();
		if (out.jsonMode || !out.isTTY) {
			out.json(endpoints);
			return;
		}

		out.table(endpoints, [
			{ key: 'endpoint', header: 'Endpoint' },
			{ key: 'description', header: 'Description' },
		]);
	});

const apiCommand = command('api')
	.description('Print a read-only Claude Status API response as JSON')
	.example((meta) => `${meta.name} api`, 'Print the full status summary')
	.example(
		(meta) => `${meta.name} api incidents/unresolved`,
		'Print unresolved incidents',
	)
	.example((meta) => `${meta.name} api list`, 'List available endpoints')
	.example(
		(meta) => `${meta.name} api ls`,
		'List endpoints using the short alias',
	)
	.command(apiListCommand)
	.arg(
		'resource',
		arg.enum(statusApiResources)
			.default('summary')
			.describe('Status API resource to fetch'),
	)
	.flag('anthropicStatusBase', anthropicStatusBaseFlag)
	.action(async ({ args, flags, out }) => {
		out.json(
			await fetchStatusApiResource(
				args.resource,
				flags.anthropicStatusBase,
			),
		);
	});

function createWebCommand(openUrl: UrlOpener = openUrlInDefaultBrowser) {
	return command('web')
		.alias('site')
		.description('Open the live status page')
		.example(
			(meta) => `${meta.name} web`,
			'Open the live status page in your browser',
		)
		.action(async ({ out }) => {
			await openUrl(pkg.homepage);
			// A progress note, not payload: stderr keeps stdout pipeable and
			// `--quiet` silences it.
			out.status(`Opening ${pkg.homepage}`);
		});
}

const webCommand = createWebCommand();

export {
	anthropicCommand,
	apiCommand,
	createWebCommand,
	downdetectorCommand,
	statusCommand,
	webCommand,
};
