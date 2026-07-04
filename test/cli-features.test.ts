import { describe, expect, test } from 'bun:test';
import { execPath } from 'node:process';

import {
	parseModelList,
	parseSourceList,
	selectedModels,
	selectedSources,
} from '#claude-down/cli/flags';
import { nameMatchesModels, sources } from '#claude-down/cli/model';
import type { Model, Source, StatusRow } from '#claude-down/cli/model';
import {
	filterAnthropicByModels,
	getExitCode,
	summarizeExitCode,
} from '#claude-down/cli/status';
import { CHROME_PATH_ENV } from '#claude-down/lib/constants';
import { findChrome } from '#claude-down/lib/downdetector/chrome';

function anthropicRow(
	overrides: Partial<Extract<StatusRow, { source: 'anthropic' }>> = {},
): StatusRow {
	return {
		source: 'anthropic',
		indicator: 'major',
		summaryText: 'Partial System Outage',
		incidents: [
			{ name: 'Claude Opus 4.8 degraded', status: 'investigating' },
			{ name: 'Sonnet latency', status: 'monitoring' },
		],
		affectedComponents: [
			{
				name: 'Claude Haiku API',
				status: 'degraded_performance',
			},
		],
		...overrides,
	};
}

const modelFlags = (
	selected: readonly Model[],
	booleans: Partial<Record<Model, boolean>> = {},
) => ({
	model: selected.map((model) => [model]),
	opus: false,
	haiku: false,
	sonnet: false,
	mythos: false,
	fable: false,
	...booleans,
});

describe('selectedModels', () => {
	test('unions --model array with convenience flags and dedupes', () => {
		expect(
			[
				...selectedModels(modelFlags(['opus'], { sonnet: true, opus: true })),
			].sort(),
		).toEqual(['opus', 'sonnet']);
	});

	test('empty when nothing selected', () => {
		expect(selectedModels(modelFlags([])).size).toBe(0);
	});
});

describe(parseModelList.name, () => {
	test('splits a comma-separated token and trims whitespace', () => {
		expect(parseModelList('opus, fable ')).toEqual(['opus', 'fable']);
	});

	test('parses a single model', () => {
		expect(parseModelList('mythos')).toEqual(['mythos']);
	});

	test('ignores empty segments', () => {
		expect(parseModelList('opus,,fable,')).toEqual(['opus', 'fable']);
	});

	test('throws a clear error for an unknown model', () => {
		expect(() => parseModelList('opus,bogus')).toThrow(
			"Invalid value 'bogus' for flag --model. Allowed: opus, haiku, sonnet, mythos, fable",
		);
	});
});

describe(parseSourceList.name, () => {
	test('splits a comma-separated token', () => {
		expect(parseSourceList('anthropic,downdetector')).toEqual([
			'anthropic',
			'downdetector',
		]);
	});

	test('throws a clear error for an unknown source', () => {
		expect(() => parseSourceList('anthropic,bogus')).toThrow(
			"Invalid value 'bogus' for flag --source. Allowed: anthropic, downdetector",
		);
	});
});

describe(selectedSources.name, () => {
	test('supports the all-sources default', () => {
		expect(selectedSources([[...sources]])).toEqual([
			'anthropic',
			'downdetector',
		]);
	});

	test('flattens per-occurrence lists', () => {
		const lists: readonly (readonly Source[])[] = [
			['anthropic'],
			['downdetector'],
		];
		expect(selectedSources(lists)).toEqual(['anthropic', 'downdetector']);
	});
});

describe(filterAnthropicByModels.name, () => {
	test('keeps only matching incidents/components and drives a major result', () => {
		const filtered = filterAnthropicByModels(
			anthropicRow(),
			new Set<Model>(['opus']),
		);
		expect(filtered).toMatchObject({
			source: 'anthropic',
			indicator: 'major',
			incidents: [
				{
					name: 'Claude Opus 4.8 degraded',
					status: 'investigating',
				},
			],
			affectedComponents: null,
		});
		expect(filtered.summaryText).toContain('opus');
	});

	test('names only affected models, omitting queried-but-unaffected ones', () => {
		const filtered = filterAnthropicByModels(
			anthropicRow(),
			new Set<Model>(['opus', 'fable']),
		);
		expect(filtered.indicator).toBe('major');
		expect(filtered.summaryText).toContain('opus');
		expect(filtered.summaryText).not.toContain('fable');
	});

	test('pluralizes the report count', () => {
		const one = filterAnthropicByModels(
			anthropicRow(),
			new Set<Model>(['opus']),
		);
		expect(one.summaryText).toBe('1 report affecting opus');

		const many = filterAnthropicByModels(
			anthropicRow(),
			new Set<Model>(['opus', 'sonnet']),
		);
		expect(many.summaryText).toBe('2 reports affecting opus, sonnet');
	});

	test('matches model names appearing only in components', () => {
		const filtered = filterAnthropicByModels(
			anthropicRow(),
			new Set<Model>(['haiku']),
		);
		expect(filtered).toMatchObject({
			indicator: 'major',
			incidents: null,
			affectedComponents: [
				{
					name: 'Claude Haiku API',
					status: 'degraded_performance',
				},
			],
		});
	});

	test('reports operational when no incident mentions the model', () => {
		const filtered = filterAnthropicByModels(
			anthropicRow(),
			new Set<Model>(['fable']),
		);
		expect(filtered).toMatchObject({
			indicator: 'none',
			incidents: null,
			affectedComponents: null,
			summaryText: 'No incidents reported for fable',
		});
	});

	test('matches broad many-model incident names', () => {
		const filtered = filterAnthropicByModels(
			anthropicRow({
				incidents: [
					{
						name: 'Elevated errors across many models',
						status: 'investigating',
					},
				],
				affectedComponents: null,
			}),
			new Set<Model>(['fable']),
		);

		expect(filtered).toMatchObject({
			indicator: 'major',
			incidents: [
				{
					name: 'Elevated errors across many models',
					status: 'investigating',
				},
			],
			summaryText: '1 report affecting fable',
		});
	});

	test('treats broad model wording as selected-model match', () => {
		expect(
			nameMatchesModels(
				'Elevated errors across many models',
				new Set<Model>(['opus']),
			),
		).toBe(true);
	});

	test('passes through the empty selection unchanged', () => {
		const row = anthropicRow();
		expect(filterAnthropicByModels(row, new Set<Model>())).toBe(row);
	});

	test('leaves unavailable rows untouched', () => {
		const row = anthropicRow({
			indicator: 'unavailable',
			incidents: null,
			affectedComponents: null,
		});
		expect(filterAnthropicByModels(row, new Set<Model>(['opus']))).toBe(row);
	});

	test('leaves downdetector rows untouched', () => {
		const row: StatusRow = {
			source: 'downdetector',
			indicator: 'major',
			summaryText: 'outage reported',
			reportsOutage: true,
		};
		expect(filterAnthropicByModels(row, new Set<Model>(['opus']))).toBe(row);
	});
});

describe('getExitCode', () => {
	test('fails when an active incident is present under an operational indicator', () => {
		expect(getExitCode(anthropicRow({ indicator: 'none' }))).toBe(1);
	});

	test('is zero when operational with no incidents', () => {
		expect(
			getExitCode(anthropicRow({ indicator: 'none', incidents: null })),
		).toBe(0);
	});

	test('reflects the indicator when it is more severe than an incident', () => {
		expect(getExitCode(anthropicRow({ indicator: 'major' }))).toBe(2);
	});

	test('reports unavailable downdetector with its dedicated code', () => {
		expect(
			getExitCode({
				source: 'downdetector',
				indicator: 'unavailable',
				summaryText: 'boom',
				reportsOutage: false,
			}),
		).toBe(21);
	});
});

describe(summarizeExitCode.name, () => {
	const unreachableDowndetector: StatusRow = {
		source: 'downdetector',
		indicator: 'unavailable',
		summaryText: 'CF challenge not cleared in time',
		reportsOutage: false,
	};

	test('ignores an unreachable source when another was readable', () => {
		// Anthropic operational with no incidents -> 0, despite Downdetector
		// being unavailable (a flaky scrape must not force 21).
		expect(
			summarizeExitCode([
				anthropicRow({ indicator: 'none', incidents: null }),
				unreachableDowndetector,
			]),
		).toBe(0);
	});

	test('keeps a real outage when another source is unreachable', () => {
		expect(
			summarizeExitCode([
				anthropicRow({ indicator: 'major' }),
				unreachableDowndetector,
			]),
		).toBe(2);
	});

	test('surfaces 21 only when every source is unreachable', () => {
		expect(
			summarizeExitCode([
				anthropicRow({
					indicator: 'unavailable',
					incidents: null,
					affectedComponents: null,
				}),
				unreachableDowndetector,
			]),
		).toBe(21);
	});

	test('is zero for no rows', () => {
		expect(summarizeExitCode([])).toBe(0);
	});
});

describe('findChrome override', () => {
	test('uses an explicit path that exists', () => {
		expect(findChrome(execPath)).toBe(execPath);
	});

	test('returns null for an explicit path that does not exist', () => {
		expect(findChrome('/no/such/chrome-binary')).toBeNull();
	});

	test('honors the CLAUDE_DOWN_CHROME environment variable', () => {
		const previous = process.env[CHROME_PATH_ENV];
		process.env[CHROME_PATH_ENV] = execPath;
		try {
			expect(findChrome()).toBe(execPath);
		} finally {
			if (previous === undefined) delete process.env[CHROME_PATH_ENV];
			else process.env[CHROME_PATH_ENV] = previous;
		}
	});
});
