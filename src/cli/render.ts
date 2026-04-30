import type { Out } from '@kjanat/dreamcli';

import { sourceLabels } from '#claude-down/cli/model.ts';
import type { StatusOutputRow, StatusRow } from '#claude-down/cli/model.ts';
import { ANTHROPIC_STATUS_BASE, DOWNDETECTOR_URL } from '#claude-down/lib/constants.ts';

const ANSI_RESET = '\x1b[0m';
const ANSI_BOLD = '\x1b[1m';
const ANSI_DIM = '\x1b[2m';
const ANSI_RED = '\x1b[31m';
const ANSI_GREEN = '\x1b[32m';
const ANSI_YELLOW = '\x1b[33m';

function paint(text: string, codes: string, enabled: boolean): string {
	return enabled ? `${codes}${text}${ANSI_RESET}` : text;
}

function hyperlink(text: string, url: string, enabled: boolean): string {
	return enabled ? `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\` : text;
}

function statusColor(row: StatusRow): string {
	if (row.indicator === 'unavailable') return ANSI_DIM;
	if (row.source === 'downdetector') {
		return row.reportsOutage ? ANSI_RED : ANSI_GREEN;
	}
	switch (row.indicator) {
		case 'none':
			return ANSI_GREEN;
		case 'minor':
			return ANSI_YELLOW;
		case 'major':
		case 'critical':
			return ANSI_RED;
	}
}

function urlFor(row: StatusRow): string {
	return row.source === 'anthropic' ? ANTHROPIC_STATUS_BASE : DOWNDETECTOR_URL;
}

function formatList(lines: string[], label: string, items: readonly string[]): void {
	if (items.length === 0) return;

	lines.push(`  ${label}:`);
	for (const item of items) {
		lines.push(`    - ${item}`);
	}
}

function formatRow(row: StatusRow, styled: boolean): string {
	const color = statusColor(row);
	const header = hyperlink(
		paint(sourceLabels[row.source], `${ANSI_BOLD}${color}`, styled),
		urlFor(row),
		styled,
	);
	const lines: string[] = [header];

	if (row.indicator === 'unavailable') {
		const reason = row.summaryText ?? 'unknown error';
		lines.push(`  ${paint(`Unavailable: ${reason}`, color, styled)}`);
		return lines.join('\n');
	}

	if (row.source === 'downdetector') {
		const summary = row.summaryText ?? 'No user-reported issues';
		lines.push(`  ${paint(summary, color, styled)}`);
		return lines.join('\n');
	}

	const summary = row.summaryText ?? 'All systems operational';
	lines.push(`  ${paint(summary, color, styled)}`);

	const incidents = row.incidents?.map((incident) => `${incident.name} (${incident.status})`) ?? [];
	formatList(lines, incidents.length === 1 ? 'Active incident' : 'Active incidents', incidents);
	formatList(
		lines,
		'Affected components',
		row.affectedComponents?.map((component) => component.name) ?? [],
	);

	return lines.join('\n');
}

function toOutputRow(row: StatusRow): StatusOutputRow {
	if (row.source === 'downdetector') {
		const status = row.indicator === 'unavailable' ? 'unavailable' : row.reportsOutage ? 'down' : 'up';
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

	out.log(rows.map((row) => formatRow(row, out.isTTY)).join('\n\n'));
}

export { renderStatusRows, toOutputRows };
