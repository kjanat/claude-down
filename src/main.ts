#!/usr/bin/env bun
/**
 * claude-down CLI — two-source check: downdetector + Anthropic statuspage.
 *
 * Runs both sources in parallel. If EITHER reports a problem → non-zero.
 * If both error → unknown. Downdetector leads Anthropic's page by minutes.
 *
 * Usage:
 *   claude-down             → one-line human summary
 *   claude-down -v          → + per-source detail, affected components, incidents
 *   claude-down --json      → combined structured payload
 *   claude-down -q          → silent, exit code only
 *
 * Exit codes:
 *   0  all operational (indicator=none)
 *   1  degraded        (anthropic minor only)
 *   2  outage          (anthropic major|critical, or downdetector reports down)
 *   3  unknown         (both sources errored)
 */

import { checkDowndetector, emoji, exitCodeFor, fetchSummary, type Indicator } from './index.ts';

const argv = new Set(Bun.argv.slice(2));
const asJson = argv.has('--json');
const quiet = argv.has('-q') || argv.has('--quiet');
const verbose = argv.has('-v') || argv.has('--verbose');

const [dd, an] = await Promise.all([checkDowndetector(), fetchSummary()]);

// Both sources failed — we can't say anything.
if (!dd.ok && an.kind === 'unknown') {
	if (asJson) {
		console.log(
			JSON.stringify({
				state: 'unknown',
				errors: { downdetector: dd.error, anthropic: an.reason },
			}),
		);
	} else if (!quiet) {
		console.log(`unknown — downdetector: ${dd.error}; anthropic: ${an.reason}`);
	}
	process.exit(3);
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

const code = exitCodeFor(indicator);

if (asJson) {
	console.log(
		JSON.stringify({
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
		}),
	);
} else if (!quiet) {
	console.log(`${emoji(indicator)} — ${description || 'operational'}`);
	if (verbose) {
		console.log('\nsources:');
		console.log(
			`  • downdetector: ${dd.ok ? (dd.down ? `down (${dd.reason})` : 'up') : `error (${dd.error})`}`,
		);
		console.log(
			`  • anthropic:    ${
				an.kind === 'ok'
					? `${an.summary.status.indicator} — ${an.summary.status.description}`
					: `error (${an.reason})`
			}`,
		);
		if (an.kind === 'ok') {
			const affected = an.summary.components.filter((c) => c.status !== 'operational');
			if (affected.length > 0) {
				console.log('\naffected components:');
				for (const c of affected) console.log(`  • ${c.name} (${c.status})`);
			}
			if (an.summary.incidents.length > 0) {
				console.log('\nlive incidents:');
				for (const i of an.summary.incidents) {
					console.log(`  • ${i.name} [${i.status}, ${i.impact}]`);
				}
			}
		}
	}
}

process.exit(code);
