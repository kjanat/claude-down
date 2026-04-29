import { CLIError } from '@kjanat/dreamcli';

import type { Source, StatusRow } from '#claude-down/cli/model.ts';
import { checkAnthropic } from '#claude-down/lib/anthropic.ts';
import { EXIT_CODES } from '#claude-down/lib/constants.ts';
import { checkDownDetector } from '#claude-down/lib/downdetector.ts';
import type { AvailableIndicator } from '#claude-down/lib/types.ts';

function normalizeIndicator(value: string): AvailableIndicator {
	if (value === 'none' || value === 'minor' || value === 'major' || value === 'critical') {
		return value;
	}

	return 'critical';
}

async function checkAnthropicSource(anthropicStatusBase: string): Promise<StatusRow> {
	const result = await checkAnthropic(anthropicStatusBase);
	if (result.kind === 'unknown') {
		throw new CLIError(`anthropic unavailable: ${result.reason}`, {
			code: 'ANTHROPIC_UNAVAILABLE',
			exitCode: EXIT_CODES.unavailable,
			details: { anthropic: result.reason },
		});
	}

	const indicator = normalizeIndicator(result.summary.status.indicator);
	const affectedComponents = result.summary.components.filter(
		(component) => component.status !== 'operational',
	);

	return {
		source: 'anthropic',
		indicator,
		summaryText: result.summary.status.description,
		incidents: result.summary.incidents.length > 0
			? result.summary.incidents.map((incident) => ({ name: incident.name, status: incident.status }))
			: null,
		affectedComponents: affectedComponents.length > 0
			? affectedComponents.map((component) => ({ name: component.name, status: component.status }))
			: null,
	};
}

async function checkDowndetectorSource(): Promise<StatusRow> {
	const result = await checkDownDetector();
	if (!result.ok) {
		throw new CLIError(`downdetector unavailable: ${result.error}`, {
			code: 'DOWNDETECTOR_UNAVAILABLE',
			exitCode: EXIT_CODES.unavailable,
			details: { downdetector: result.error },
		});
	}

	return {
		source: 'downdetector',
		indicator: result.down ? 'major' : 'none',
		summaryText: result.down ? result.reason : null,
		reportsOutage: result.down,
	};
}

async function checkSource(source: Source, anthropicStatusBase: string): Promise<StatusRow> {
	switch (source) {
		case 'anthropic':
			return checkAnthropicSource(anthropicStatusBase);
		case 'downdetector':
			return checkDowndetectorSource();
	}
}

async function checkSources(
	sources: readonly Source[],
	anthropicStatusBase: string,
): Promise<readonly StatusRow[]> {
	return Promise.all(sources.map((source) => checkSource(source, anthropicStatusBase)));
}

function getExitCode(row: StatusRow): number {
	return EXIT_CODES[row.indicator];
}

function summarizeExitCode(rows: readonly StatusRow[]): number {
	return rows.reduce<number>((max, row) => Math.max(max, getExitCode(row)), EXIT_CODES.none);
}

function sortRows(rows: readonly StatusRow[]): StatusRow[] {
	return [...rows].sort((left, right) => left.source.localeCompare(right.source));
}

export {
	checkAnthropicSource,
	checkDowndetectorSource,
	checkSource,
	checkSources,
	getExitCode,
	sortRows,
	summarizeExitCode,
};
