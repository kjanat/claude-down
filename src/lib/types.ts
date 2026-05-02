import type {
	Component,
	IncidentImpact,
	IncidentStatus,
	Summary,
} from 'statuspage.io';

/** String values of `statuspage.io`'s {@linkcode IncidentImpact} enum. */
type IncidentImpactValue = `${IncidentImpact}`;

/** String values of `statuspage.io`'s {@linkcode IncidentStatus} enum. */
type IncidentStatusValue = `${IncidentStatus}`;

/** Status for the state of a service.
 * - `'unavailable'` when a source can't be reached. */
type Indicator = IncidentImpactValue | 'unavailable';

/** The closed set of component statuses `statuspage.io` emits.
 *
 * Hand-rolled because upstream types {@linkcode Component["status"]} as `string`. */
type ComponentStatus =
	| 'operational'
	| 'degraded_performance'
	| 'partial_outage'
	| 'major_outage'
	| 'under_maintenance' // unsure?
	| Component['status'];

/** A signal represents the outcome of a status check. */
type Signal =
	| {
		/** The check was successful. */
		ok: true;
		/** The service is down. */
		down: true;
		/** The reason for the downtime. */
		reason: string;
	}
	| {
		/** The check was successful. */
		ok: true;
		/** The service is up. */
		down: false;
	}
	| {
		/** The check failed. */
		ok: false;
		/** The reason for the failure. */
		error: string;
	};

/** The result of a status check. */
type Result =
	| {
		/** Headers from the response, included when available for debugging purposes. */
		headers: Headers;
		/** A discriminant property that indicates the type of result.
		 * - `'ok'` for a successful summary. */
		kind: 'ok';
		/** The summary of the status page, included when the result is 'ok'. @see {@linkcode Summary} */
		summary: Summary;
	}
	| {
		/** Headers from the response, included when available for debugging purposes. */
		headers?: Headers;
		/** A discriminant property that indicates the type of result.
		 * - `'unknown'` for an unknown state. */
		kind: 'unknown';
		/** The reason for the unknown state. */
		reason: string;
	};

export type {
	ComponentStatus,
	IncidentImpactValue,
	IncidentStatusValue,
	Indicator,
	Result,
	Signal,
};

export type { Summary } from 'statuspage.io';
