import { strip } from 'ansispeck';
import { describe, expect, test } from 'bun:test';
import { IncidentImpact, IncidentStatus } from 'statuspage.io';
import type { Incident, IncidentUpdate, Summary } from 'statuspage.io';

import { statusApiEndpoint } from '#claude-down/cli/api';
import { renderStatusRow } from '#claude-down/cli/render';
import { anthropicSummaryToRow } from '#claude-down/cli/status';
import { ANTHROPIC_STATUS_BASE } from '#claude-down/lib/constants';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
	return value === null || typeof value === 'string';
}

function isIncidentUpdate(value: unknown): value is IncidentUpdate {
	return isRecord(value)
		&& typeof value.body === 'string'
		&& typeof value.created_at === 'string'
		&& typeof value.display_at === 'string'
		&& typeof value.id === 'string'
		&& typeof value.incident_id === 'string'
		&& Object.values(IncidentStatus).includes(value.status as IncidentStatus)
		&& typeof value.updated_at === 'string';
}

function isIncident(value: unknown): value is Incident {
	return isRecord(value)
		&& typeof value.created_at === 'string'
		&& typeof value.id === 'string'
		&& Object.values(IncidentImpact).includes(value.impact as IncidentImpact)
		&& Array.isArray(value.incident_updates)
		&& value.incident_updates.every(isIncidentUpdate)
		&& isNullableString(value.monitoring_at)
		&& typeof value.name === 'string'
		&& typeof value.page_id === 'string'
		&& isNullableString(value.resolved_at)
		&& typeof value.shortlink === 'string'
		&& Object.values(IncidentStatus).includes(value.status as IncidentStatus)
		&& typeof value.updated_at === 'string';
}

function isPage(value: unknown): value is Summary['page'] {
	return isRecord(value)
		&& typeof value.id === 'string'
		&& typeof value.name === 'string'
		&& typeof value.time_zone === 'string'
		&& typeof value.updated_at === 'string'
		&& typeof value.url === 'string';
}

async function fetchResolvedIncidentHistory(): Promise<{
	incidents: Incident[];
	page: Summary['page'];
}> {
	const url = new URL(
		statusApiEndpoint('incidents'),
		ANTHROPIC_STATUS_BASE,
	);
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Live incident history request failed: ${response.status} ${response.statusText}`,
		);
	}

	const payload: unknown = await response.json();
	if (
		!isRecord(payload)
		|| !isPage(payload.page)
		|| !Array.isArray(payload.incidents)
		|| !payload.incidents.every(isIncident)
	) {
		throw new Error('Live incident history returned an unexpected shape');
	}

	const incidents = payload.incidents.filter(
		(incident) => incident.status === IncidentStatus.Resolved,
	);
	if (incidents.length === 0) {
		throw new Error('Live incident history returned no resolved incidents');
	}

	return { incidents, page: payload.page };
}

const liveHistory = await fetchResolvedIncidentHistory();
const [sourceIncident] = liveHistory.incidents;
if (sourceIncident === undefined) {
	throw new Error('Live incident history returned no source incident');
}

const lifecycleCases = Object.values(IncidentStatus).map((status) => ({
	...sourceIncident,
	status,
}));
const impactCases = Object.values(IncidentImpact).map((impact) => ({
	...sourceIncident,
	impact,
}));

function summaryWithIncident(incident: Incident): Summary {
	return {
		components: [],
		incidents: [incident],
		page: liveHistory.page,
		scheduled_maintenances: [],
		status: {
			description: 'All Systems Operational',
			indicator: 'none',
		},
	};
}

function mapAndRenderIncident(incident: Incident) {
	const row = anthropicSummaryToRow(summaryWithIncident(incident));
	if (row.source !== 'anthropic') {
		throw new Error('Expected an Anthropic status row');
	}

	const stdout: string[] = [];
	const out = {
		isHyperlinkSupported: true,
		isTTY: true,
		jsonMode: false,
		log: (line: string) => stdout.push(line),
	} as unknown as Parameters<typeof renderStatusRow>[1];
	renderStatusRow(row, out);

	return { output: stdout[0] ?? '', row };
}

describe('live historical Statuspage incidents', () => {
	test.each(liveHistory.incidents)(
		'maps and renders complete resolved incident $id ($impact)',
		(incident) => {
			const { output, row } = mapAndRenderIncident(incident);
			const expectedUrl = incident.shortlink.length > 0
				? incident.shortlink
				: new URL(
					`/incidents/${encodeURIComponent(incident.id)}`,
					ANTHROPIC_STATUS_BASE,
				).href;

			expect(row.indicator).toBe('none');
			expect(row.incidents).toHaveLength(1);
			expect(row.incidents?.[0]).toStrictEqual({
				createdAt: incident.created_at,
				impact: incident.impact,
				name: incident.name,
				status: incident.status,
				updatedAt: incident.updated_at,
				url: expectedUrl,
			});
			expect(output).toContain(expectedUrl);
			expect(strip(output)).toContain(
				`${incident.name} ↗ [${incident.impact.toUpperCase()}] (${incident.status}) — Created `,
			);
		},
	);

	test.each(lifecycleCases)(
		'labels lifecycle status $status on complete live incident $id',
		(incident) => {
			const { output, row } = mapAndRenderIncident(incident);

			expect(row.incidents?.[0]).toHaveProperty('status', incident.status);
			expect(strip(output)).toContain(`(${incident.status})`);
		},
	);

	test.each(impactCases)(
		'categorizes impact $impact on complete live incident $id',
		(incident) => {
			const { output, row } = mapAndRenderIncident(incident);

			expect(row.incidents?.[0]).toHaveProperty('impact', incident.impact);
			expect(strip(output)).toContain(`[${incident.impact.toUpperCase()}]`);
		},
	);
});
