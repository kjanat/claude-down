import type { Component, Incident } from '#claude-down/browser';

import { getString, isRecord } from './util.ts';

type HeroStatus = {
	description: string;
	indicator: string;
};

type StatusSummary = {
	status: HeroStatus;
	incidents: Incident[];
	components: Component[];
};

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

function normalizeSummary(result: unknown): StatusSummary {
	const payload = getPayload(result);

	if (!isRecord(payload)) {
		throw new Error('Invalid status response');
	}

	return {
		status: normalizeHeroStatus(payload.status),
		incidents: Array.isArray(payload.incidents)
			? payload.incidents as Incident[]
			: [],
		components: Array.isArray(payload.components)
			? payload.components as Component[]
			: [],
	};
}

export type { HeroStatus, StatusSummary };
export {
	getResultErrorMessage,
	getResultHeaders,
	isFailureResult,
	normalizeSummary,
};
