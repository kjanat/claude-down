/**
 * claude-down CLI — two-source check: downdetector + Anthropic statuspage.
 *
 * Runs both sources in parallel. If EITHER reports a problem → non-zero.
 * If both error → unknown. Downdetector leads Anthropic's page by minutes.
 *
 * Usage:
 *   claude-down             → human summary + per-source detail, affected components, incidents
 *   claude-down --json      → combined structured payload
 *   claude-down -q          → silent, exit code only
 *
 * Exit codes:
 *   0  all operational (indicator=none)
 *   1  degraded        (anthropic minor only)
 *   2  outage          (anthropic major|critical, or downdetector reports down)
 *   3  unknown         (both sources errored)
 */

import { cli, CLIError, command, flag } from '@kjanat/dreamcli';
import { exit } from 'node:process';
import { checkDowndetector, emoji, exitCodeFor, fetchSummary, type Indicator } from './index.ts';

const statusCmd = command('status')
	.description('Tell if Claude is down (downdetector + Anthropic statuspage)')
	.flag('quiet', flag.boolean().alias('q').describe('Silent; exit code only'))
	.action(async ({ flags, out }) => {
		const [dd, an] = await Promise.all([checkDowndetector(), fetchSummary()]);

		// Both sources failed — we can't say anything.
		if (!dd.ok && an.kind === 'unknown') {
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

		if (out.jsonMode) {
			out.json({
				state: emoji(indicator),
				indicator,
				description,
				downdetector: dd.ok
					? { down: dd.down, reason: dd.down ? dd.reason : null }
					: { error: dd.error },
				anthropic: an.kind === 'ok'
					? {
						indicator: an.summary.status.indicator,
						description: an.summary.status.description,
						incidents: an.summary.incidents.map((i) => ({
							name: i.name,
							status: i.status,
							impact: i.impact,
						})),
						affected: an.summary.components
							.filter((c) => c.status !== 'operational')
							.map((c) => ({ name: c.name, status: c.status })),
					}
					: { error: an.reason },
			});
		} else if (!flags.quiet) {
			out.log(
				`${emoji(indicator)} — ${description || 'operational'}

sources:
  • downdetector: ${dd.ok ? (dd.down ? `down (${dd.reason})` : 'up') : `error (${dd.error})`}
  • anthropic:    ${
					an.kind === 'ok'
						? `${an.summary.status.indicator} — ${an.summary.status.description}`
						: `error (${an.reason})`
				}${
					an.kind === 'ok'
						&& an.summary.components.some((c) => c.status !== 'operational')
						? `\n\naffected components:\n${
							an.summary.components
								.filter((c) => c.status !== 'operational')
								.map((c) => `  • ${c.name} (${c.status})`)
								.join('\n')
						}`
						: ''
				}${
					an.kind === 'ok' && an.summary.incidents.length > 0
						? `\n\nlive incidents:\n${
							an.summary.incidents
								.map((i) => `  • ${i.name} [${i.status}, ${i.impact}]`)
								.join('\n')
						}`
						: ''
				}`,
			);
		}

		exit(exitCodeFor(indicator));
	});

cli('down').packageJson({ inferName: true })
	.default(statusCmd).completions()
	.run();
