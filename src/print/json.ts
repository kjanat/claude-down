import { emoji } from '#claude-down/format.ts';
import type { Indicator, Result, Signal } from '#claude-down/types.ts';

export function printJson(indicator: Indicator, description: string, dd: Signal, an: Result): unknown {
	return {
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
	};
}
