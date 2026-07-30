import type { Out } from '@kjanat/dreamcli';
import { createColors } from 'ansispeck';
import type { Colors } from 'ansispeck';

import { sourceLabels } from '#claude-down/cli/model';
import type { StatusOutputRow, StatusRow } from '#claude-down/cli/model';
import {
	ANTHROPIC_STATUS_BASE,
	DOWNDETECTOR_URL,
} from '#claude-down/lib/constants';
import type { IncidentImpactValue } from '#claude-down/lib/types';
import pkg from '#pkg' with { type: 'json' };

type ColorFn = (text: string) => string;

function indicatorColors(c: Colors): Record<IncidentImpactValue, ColorFn> {
	return {
		none: c.green,
		minor: c.yellow,
		major: c.red,
		critical: c.red,
	};
}

type RenderStatusRowOptions = Readonly<{
	leadingBlank?: boolean;
}>;

function statusColor(row: StatusRow, c: Colors): ColorFn {
	if (row.indicator === 'unavailable') return c.dim;
	return indicatorColors(c)[row.indicator];
}

function urlFor(row: StatusRow): string {
	return row.source === 'anthropic' ? ANTHROPIC_STATUS_BASE : DOWNDETECTOR_URL;
}

function formatList(
	lines: string[],
	label: string,
	items: readonly string[],
): void {
	if (items.length === 0) return;

	lines.push(`  ${label}:`);
	for (const item of items) {
		lines.push(`    - ${item}`);
	}
}

function formatRow(row: StatusRow, styled: boolean, hyperlinks: boolean): string {
	const c = createColors(styled, hyperlinks);
	const color = statusColor(row, c);
	const header = c.link(
		urlFor(row),
		c.underline(c.bold(color(sourceLabels[row.source]))),
	);
	const lines: string[] = [header];

	if (row.indicator === 'unavailable') {
		const reason = row.summaryText ?? 'unknown error';
		lines.push(`  ${color(`Unavailable: ${reason}`)}`);
		return lines.join('\n');
	}

	if (row.source === 'downdetector') {
		const summary = row.summaryText ?? 'No user-reported issues';
		lines.push(`  ${color(summary)}`);
		return lines.join('\n');
	}

	const summary = row.summaryText ?? 'All systems operational';
	lines.push(`  ${color(summary)}`);

	const incidents =
		row.incidents?.map((incident) => `${incident.name} (${incident.status})`)
			?? [];
	formatList(
		lines,
		incidents.length === 1 ? 'Active incident' : 'Active incidents',
		incidents,
	);
	formatList(
		lines,
		'Affected components',
		row.affectedComponents?.map((component) => component.name) ?? [],
	);

	return lines.join('\n');
}

function toOutputRow(row: StatusRow): StatusOutputRow {
	if (row.source === 'downdetector') {
		const status = row.indicator === 'unavailable'
			? 'unavailable'
			: row.reportsOutage
			? 'down'
			: 'up';
		return {
			source: 'downdetector',
			status,
			details: row.summaryText,
		};
	}

	return {
		source: 'anthropic',
		status: row.indicator === 'none' ? 'up' : row.indicator,
		details: row.summaryText,
		incidents: row.incidents,
		affected: row.affectedComponents,
	};
}

function toOutputRows(rows: readonly StatusRow[]): StatusOutputRow[] {
	return rows.map((row) => toOutputRow(row));
}

function renderStatusRows(rows: readonly StatusRow[], out: Out): void {
	if (out.jsonMode || !out.isTTY) {
		out.json(toOutputRows(rows));
		return;
	}

	out.log(
		rows
			.map((row) => formatRow(row, out.isTTY, out.isHyperlinkSupported))
			.join('\n\n'),
	);
}

/**
 * Renders a single styled status row, used by the interactive path to print
 * each source the moment it resolves. Only invoked in TTY, non-JSON mode, so
 * styling always tracks {@linkcode Out.isTTY}.
 */
function renderStatusRow(
	row: StatusRow,
	out: Out,
	options: RenderStatusRowOptions = {},
): void {
	const prefix = options.leadingBlank === true ? '\n' : '';
	out.log(`${prefix}${formatRow(row, out.isTTY, out.isHyperlinkSupported)}`);
}

/**
 * Trailing pointer to the auto-polling web page, printed under human status
 * output. Dimmed and OSC 8-linked so it stays unobtrusive yet clickable.
 * Emitted through `out.status()` — a stderr side channel that keeps stdout
 * pipeable and is suppressed under `--quiet` — and skipped in JSON/non-TTY
 * so machine-readable output is left untouched.
 */
function renderPageFooter(out: Out): void {
	if (out.jsonMode || !out.isTTY) return;

	const c = createColors(true, out.isHyperlinkSupported);
	const link = c.link(pkg.homepage, c.underline(pkg.homepage));
	out.status(`\n${c.dim(`Watch the live status page: ${link}`)}`);
}

export { renderPageFooter, renderStatusRow, renderStatusRows, toOutputRows };
