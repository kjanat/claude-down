import type { Component, Incident } from '#claude-down/browser';
import {
	deriveConservativeIndicator,
	describeIndicator,
} from '#claude-down/lib/severity';

import { getString, isRecord } from './util.ts';

interface HeroStatus {
	description: string;
	indicator: string;
	reportedIndicator?: string;
}

interface StatusSummary {
	components: Component[];
	incidents: Incident[];
	status: HeroStatus;
}

function getResultErrorMessage(result: unknown): string {
	if (!isRecord(result)) {
		return result instanceof Error ? result.message : String(result);
	}

	const reason = result.reason ?? result.error ?? result.message;

	if (reason instanceof Error) {
		return reason.message;
	}

	if (typeof reason === 'string') {
		return reason;
	}

	return 'Unknown error';
}

function getResultHeaders(result: unknown): Headers | undefined {
	if (!isRecord(result)) {
		return undefined;
	}

	return result.headers instanceof Headers ? result.headers : undefined;
}

function isFailureResult(result: unknown): boolean {
	if (!isRecord(result)) {
		return false;
	}

	if (result.kind !== undefined) {
		return result.kind !== 'ok';
	}

	if (result.ok !== undefined) {
		return result.ok !== true;
	}

	if (result.success !== undefined) {
		return result.success !== true;
	}

	return false;
}

function getPayload(result: unknown): unknown {
	if (!isRecord(result)) {
		return result;
	}

	return result.summary
		?? result.data
		?? result.value
		?? result.result
		?? result;
}

function normalizeHeroStatus(value: unknown): HeroStatus {
	if (isRecord(value)) {
		const indicator = getString(value.indicator, 'none');
		const description = getString(
			value.description,
			indicator === 'none'
				? 'All Systems Operational'
				: `Indicator: ${indicator}`,
		);

		return { description, indicator };
	}

	if (typeof value === 'string') {
		return {
			description: value,
			indicator: value === 'operational' ? 'none' : value,
		};
	}

	return {
		description: 'Unknown status',
		indicator: 'major',
	};
}

function hasStringProperty(
	value: Record<string, unknown>,
	key: string,
): boolean {
	return typeof value[key] === 'string';
}

function isIncident(value: unknown): value is Incident {
	return isRecord(value)
		&& hasStringProperty(value, 'name')
		&& hasStringProperty(value, 'impact')
		&& hasStringProperty(value, 'status')
		&& hasStringProperty(value, 'created_at')
		&& hasStringProperty(value, 'updated_at');
}

function isComponent(value: unknown): value is Component {
	return isRecord(value)
		&& hasStringProperty(value, 'name')
		&& hasStringProperty(value, 'status');
}

function normalizeSummary(result: unknown): StatusSummary {
	const payload = getPayload(result);

	if (!isRecord(payload)) {
		throw new Error('Invalid status response');
	}

	const status = normalizeHeroStatus(payload.status);
	const incidents = Array.isArray(payload.incidents)
		? payload.incidents.filter(isIncident)
		: [];
	const components = Array.isArray(payload.components)
		? payload.components.filter(isComponent)
		: [];
	const conservativeIndicator = deriveConservativeIndicator(
		status.indicator,
		incidents,
		components,
	);

	return {
		status: {
			description: conservativeIndicator === status.indicator
				? status.description
				: describeIndicator(conservativeIndicator),
			indicator: conservativeIndicator,
			reportedIndicator: status.indicator,
		},
		incidents,
		components,
	};
}

export type { HeroStatus, StatusSummary };
export {
	getResultErrorMessage,
	getResultHeaders,
	isFailureResult,
	normalizeSummary,
};
