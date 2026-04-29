import type { Out } from '@kjanat/dreamcli';

import { sourceLabels } from '#claude-down/cli/model.ts';
import type { StatusOutputRow, StatusRow } from '#claude-down/cli/model.ts';

function formatList(lines: string[], label: string, items: readonly string[]): void {
	if (items.length === 0) return;

	lines.push(`  ${label}:`);
	for (const item of items) {
		lines.push(`    - ${item}`);
	}
}

function formatRow(row: StatusRow): string {
	const lines: string[] = [sourceLabels[row.source]];

	if (row.source === 'downdetector') {
		lines.push(`  ${row.summaryText ?? 'No user-reported issues'}`);
		return lines.join('\n');
	}

	lines.push(`  ${row.summaryText ?? 'All systems operational'}`);

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
		return {
			source: 'downdetector',
			status: row.reportsOutage ? 'down' : 'up',
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

	out.log(rows.map((row) => formatRow(row)).join('\n\n'));
}

export { renderStatusRows, toOutputRows };
