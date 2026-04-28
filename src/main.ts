#!/usr/bin/env node

import { cli, command, flag, middleware } from '@kjanat/dreamcli';
import { env, exit, stdout } from 'node:process';
import { checkAnthropic, checkDownDetector, EXIT_CODES, toCLIError } from './index.ts';

const sources = ['anthropic', 'downdetector'] as const;
const sourceLabels = {
	anthropic: 'Anthropic',
	downdetector: 'Downdetector',
} as const;

type Source = (typeof sources)[number];
type Indicator = keyof typeof EXIT_CODES;

function isApiIndicator(v: string): v is Exclude<Indicator, 'unavailable'> {
	return v === 'none' || v === 'minor' || v === 'major' || v === 'critical';
}

type StatusRow = {
	source: Source;
	status: string;
	details: string | null;
	incidents?: Array<{ name: string; status: string }> | null;
	affected?: Array<{ name: string; status: string }> | null;
};

type Output = {
	jsonMode: boolean;
	json(value: unknown): void;
	log(message: string): void;
};

function formatStatusRow(row: StatusRow): string {
	const lines = [`${sourceLabels[row.source]}: ${row.status}`];

	if (row.details !== null) lines.push(`  ${row.details}`);
	if (row.incidents !== null && row.incidents !== undefined) {
		for (const incident of row.incidents) {
			lines.push(`  incident: ${incident.name} [${incident.status}]`);
		}
	}
	if (row.affected !== null && row.affected !== undefined) {
		lines.push(
			`  affected: ${row.affected.map(component => `${component.name} [${component.status}]`).join(', ')}`,
		);
	}

	return lines.join('\n');
}

function formatStatusRows(rows: StatusRow[]): string {
	return rows.map(formatStatusRow).join('\n\n');
}

function getAnthropicStatusBase(): string | undefined {
	const baseUrl = env.CLAUDE_DOWN_ANTHROPIC_STATUS_BASE;
	return baseUrl !== undefined && baseUrl.length > 0 ? baseUrl : undefined;
}

function renderResult(result: number | StatusRow[], out: Output): void {
	if (typeof result === 'number') {
		exit(result);
	}

	if (out.jsonMode) {
		out.json(result);
		return;
	}

	out.log(formatStatusRows(result));
}

async function main(
	{ quiet, source }: { quiet: boolean; source: Source },
): Promise<number | StatusRow[]> {
	const anthropicStatusBase = getAnthropicStatusBase();
	const [dd, an] = await Promise.all([
		source === 'anthropic'
			? ({ ok: true, down: false } as const)
			: checkDownDetector(),
		source === 'downdetector'
			? ({ kind: 'unknown', reason: 'skipped' } as const)
			: checkAnthropic(anthropicStatusBase),
	]);

	if (source === 'anthropic' && an.kind === 'unknown') {
		throw toCLIError({
			code: 'ANTHROPIC_UNAVAILABLE',
			message: `anthropic unavailable: ${an.reason}`,
			details: { anthropic: an.reason },
		});
	}

	if (source === 'downdetector' && !dd.ok) {
		throw toCLIError({
			code: 'DOWNDETECTOR_UNAVAILABLE',
			message: `downdetector unavailable: ${dd.error}`,
			details: { downdetector: dd.error },
		});
	}

	let indicator: Indicator = 'none';
	let description = '';

	if (an.kind === 'ok') {
		const raw = an.summary.status.indicator;
		indicator = isApiIndicator(raw) ? raw : 'critical';
		description = an.summary.status.description;
	}

	if (dd.ok && dd.down) {
		if (indicator === 'none' || indicator === 'minor') indicator = 'major';
		const suffix = `downdetector: ${dd.reason}`;
		description = description ? `${description} · ${suffix}` : suffix;
	}

	if (quiet) {
		return EXIT_CODES[indicator];
	}

	const table: StatusRow[] = [];

	if (source === 'downdetector') {
		table.push({
			source: 'downdetector',
			status: dd.ok ? (dd.down ? 'down' : 'up') : 'error',
			details: dd.ok ? (dd.down ? dd.reason : null) : dd.error,
		});
	}

	if (source === 'anthropic') {
		const ok = an.kind === 'ok';
		const affected = ok
			? an.summary.components.filter(component => component.status !== 'operational')
			: null;
		table.push({
			source: 'anthropic',
			status: ok
				? an.summary.status.indicator === 'none'
					? 'up'
					: an.summary.status.indicator
				: 'error',
			details: ok ? an.summary.status.description : an.reason,
			incidents: ok && an.summary.incidents.length > 0 ? an.summary.incidents : null,
			affected: affected !== null && affected.length > 0 ? affected : null,
		});
	}

	return table.sort((a, b) => a.source.localeCompare(b.source));
}

const withExitOrTable = middleware<{ exitOrTable: (result: number | StatusRow[]) => void }>(
	({ out, next }) =>
		next({
			exitOrTable: (result: number | StatusRow[]) => renderResult(result, out),
		}),
);

const quietFlag = flag.boolean().alias('q').describe('Silent; exit code only');
const sourceFlag = flag.enum(sources).required().alias('s').describe('Data source to check');

const statusCommand = command('status')
	.description('Tell if Claude is down (downdetector + Anthropic statuspage)')
	.flag('quiet', quietFlag)
	.flag(
		'sources',
		flag.array(flag.enum(sources)).required().default([...sources]).alias('s').describe('Data source(s) to check'),
	)
	.middleware(withExitOrTable)
	.action(async ({ flags, ctx }) => {
		const results = await Promise.all(
			flags.sources.map(s => main({ quiet: flags.quiet, source: s })),
		);
		const maxCode = results.reduce<number | null>(
			(max, r) => typeof r === 'number' ? (max === null ? r : Math.max(max, r)) : max,
			null,
		);
		if (maxCode !== null) {
			ctx.exitOrTable(maxCode);
			return;
		}
		ctx.exitOrTable(results.flatMap(r => Array.isArray(r) ? r : []));
	});

const anthropicCommand = command('anthropic')
	.description('Check only Anthropic statuspage')
	.flag('quiet', quietFlag)
	.flag('source', sourceFlag.default('anthropic')).hidden()
	.middleware(withExitOrTable)
	.action(async ({ flags, ctx }) => {
		ctx.exitOrTable(await main({ quiet: flags.quiet, source: flags.source }));
	});

const dowDetectorCommand = command('downdetector')
	.description('Check only Downdetector')
	.flag('quiet', quietFlag)
	.flag('source', sourceFlag.default('downdetector')).hidden()
	.middleware(withExitOrTable)
	.action(async ({ flags, ctx }) => {
		ctx.exitOrTable(await main({ quiet: flags.quiet, source: flags.source }));
	});

export const claudeDown = cli('claude-down')
	.packageJson({ inferName: true })
	.default(statusCommand)
	.command(anthropicCommand)
	.command(dowDetectorCommand)
	.completions();

if (import.meta.main) {
	claudeDown.run({ help: { width: stdout.columns } });
}
