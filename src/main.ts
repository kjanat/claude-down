/**
 * claude-down CLI — two-source check: downdetector + Anthropic statuspage.
 *
 * Runs both sources in parallel. If EITHER reports a problem → non-zero.
 * If both error → unknown. Downdetector leads Anthropic's page by minutes.
 *
 * Usage:
 *   claude-down               → human summary + per-source detail, affected components, incidents
 *   claude-down anthropic     → check only Anthropic status
 *   claude-down downdetector  → check only Downdetector
 *   claude-down --json        → combined structured payload
 *   claude-down -q            → silent, exit code only
 *
 * Exit codes:
 *   0  all operational (indicator=none)
 *   1  degraded        (anthropic minor only)
 *   2  outage          (anthropic major|critical, or downdetector reports down)
 *   3  unknown         (both sources errored)
 */

import { checkDowndetector, exitCodeFor, fetchSummary, type Indicator } from '#claude-down';
import { getSourcesTable } from '#claude-down/print';
import { cli, CLIError, command, flag } from '@kjanat/dreamcli';
import { exit } from 'node:process';

const statusAction = async ({ flags, out }: any, sourceOverride?: string) => {
	const source = sourceOverride ?? flags.source;
	const [dd, an] = await Promise.all([
		source === 'anthropic' ? { ok: true, down: false } as const : checkDowndetector(),
		source === 'downdetector' ? { kind: 'unknown', reason: 'skipped' } as const : fetchSummary(),
	]);

	// Error handling: if a requested source fails, we can't give a reliable answer.
	if (source === 'anthropic' && an.kind === 'unknown') {
		throw new CLIError(`anthropic unavailable: ${an.reason}`, {
			code: 'ANTHROPIC_UNAVAILABLE',
			exitCode: 3,
			details: { anthropic: an.reason },
		});
	}
	if (source === 'downdetector' && !dd.ok) {
		throw new CLIError(`downdetector unavailable: ${dd.error}`, {
			code: 'DOWNDETECTOR_UNAVAILABLE',
			exitCode: 3,
			details: { downdetector: dd.error },
		});
	}
	if (!source && !dd.ok && an.kind === 'unknown') {
		throw new CLIError(`unknown — downdetector: ${dd.error}; anthropic: ${an.reason}`, {
			code: 'SOURCES_UNAVAILABLE',
			exitCode: 3,
			details: { downdetector: dd.error, anthropic: an.reason },
		});
	}

	// Merge: anthropic is authoritative for tiered severity. Downdetector is
	// binary; when it reports down we bump below-major indicators up to major.
	let indicator: Indicator = 'none';
	let description = '';
	if (an.kind === 'ok') {
		indicator = an.summary.status.indicator;
		description = an.summary.status.description;
	}
	if (dd.ok && dd.down) {
		if (indicator === 'none' || indicator === 'minor') indicator = 'major';
		const suffix = `downdetector: ${dd.reason}`;
		description = description ? `${description} · ${suffix}` : suffix;
	}

	if (flags.quiet) {
		exit(exitCodeFor(indicator));
	}

	out.table(getSourcesTable(dd, an, source));
	exit(exitCodeFor(indicator));
};

const statusCmd = command('status')
	.description('Tell if Claude is down (downdetector + Anthropic statuspage)')
	.flag('quiet', flag.boolean().alias('q').describe('Silent; exit code only'))
	.flag('source', flag.string().alias('s').describe('Only check one source (anthropic | downdetector)'))
	.action(statusAction);

const anthropicCmd = command('anthropic')
	.description('Check only Anthropic statuspage')
	.flag('quiet', flag.boolean().alias('q').describe('Silent; exit code only'))
	.action((ctx) => statusAction(ctx, 'anthropic'));

const downdetectorCmd = command('downdetector')
	.description('Check only Downdetector')
	.flag('quiet', flag.boolean().alias('q').describe('Silent; exit code only'))
	.action((ctx) => statusAction(ctx, 'downdetector'));

cli('down').packageJson({ inferName: true })
	.default(statusCmd)
	.command(anthropicCmd)
	.command(downdetectorCmd)
	.completions()
	.run();
