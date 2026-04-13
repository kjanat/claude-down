import { statusLabel } from '#claude-down';
import type { Indicator, Result, Signal } from '#claude-down/types.ts';

export function getStatusSummary(indicator: Indicator, description: string): string {
	return `${statusLabel(indicator)} — ${description || 'operational'}`;
}

export function getSourcesTable(dd: Signal, an: Result, requestedSource?: string): any[] {
	const table: any[] = [];

	if (!requestedSource || requestedSource === 'downdetector') {
		table.push({
			source: 'downdetector',
			status: dd.ok ? (dd.down ? 'down' : 'up') : 'error',
			details: dd.ok ? (dd.down ? dd.reason : '-') : dd.error,
		});
	}

	if (!requestedSource || requestedSource === 'anthropic') {
		const status = an.kind === 'ok'
			? (an.summary.status.indicator === 'none' ? 'up' : an.summary.status.indicator)
			: 'error';
		const details = an.kind === 'ok' ? an.summary.status.description : an.reason;

		table.push({
			source: 'anthropic',
			status,
			details,
		});
	}

	return table.sort((a, b) => a.source.localeCompare(b.source));
}
