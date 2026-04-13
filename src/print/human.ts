import { emoji } from '#claude-down/format.ts';
import type { Indicator, Result, Signal } from '#claude-down/types.ts';

export function printHumanText(indicator: Indicator, description: string, dd: Signal, an: Result): string {
	return `${emoji(indicator)} — ${description || 'operational'}

sources:
  - downdetector: ${dd.ok ? (dd.down ? `down (${dd.reason})` : 'up') : `error (${dd.error})`}
  - anthropic:    ${
		an.kind === 'ok'
			? `${an.summary.status.indicator} — ${an.summary.status.description}`
			: `error (${an.reason})`
	}${
		an.kind === 'ok'
			&& an.summary.components.some((c) => c.status !== 'operational')
			? `\n\naffected components:\n${
				an.summary.components
					.filter((c) => c.status !== 'operational')
					.map((c) => `  - ${c.name} (${c.status})`)
					.join('\n')
			}`
			: ''
	}${
		an.kind === 'ok' && an.summary.incidents.length > 0
			? `\n\nlive incidents:\n${
				an.summary.incidents
					.map((i) => `  - ${i.name} [${i.status}, ${i.impact}]`)
					.join('\n')
			}`
			: ''
	}`;
}
