import type { IncidentImpact, IncidentStatus, Summary } from 'statuspage.io';

/** Indicator represents the specific status code or condition that can be used to determine the state of a service.
 *
 * `'unavailable'` is a synthetic state injected when a source can't be reached;\
 * statuspage.io itself only emits the {@link AvailableIndicator} subset.
 */
type Indicator = 'none' | 'minor' | 'major' | 'critical' | 'unavailable';
type AvailableIndicator = Exclude<Indicator, 'unavailable'>;

/** String values of statuspage.io's `IncidentImpact` enum, derived so it stays in sync if upstream adds members. */
type IncidentImpactValue = `${IncidentImpact}`;

/** String values of statuspage.io's `IncidentStatus` enum, derived so it stays in sync if upstream adds members. */
type IncidentStatusValue = `${IncidentStatus}`;

/** The closed set of component statuses statuspage.io emits. Hand-rolled because upstream types `Component.status` as `string`. */
type ComponentStatus =
	| 'operational'
	| 'degraded_performance'
	| 'partial_outage'
	| 'major_outage'
	| 'under_maintenance';

/** A signal represents the outcome of a status check, indicating whether the service is down and providing relevant information. */
type Signal =
	| { ok: true; down: true; reason: string }
	| { ok: true; down: false }
	| { ok: false; error: string };

/** The result of a status check, which can either be a successful summary or an unknown state with a reason. */
type Result =
	| { headers: Headers; kind: 'ok'; summary: Summary }
	| { headers?: Headers; kind: 'unknown'; reason: string };

export type {
	AvailableIndicator,
	ComponentStatus,
	IncidentImpactValue,
	IncidentStatusValue,
	Indicator,
	Result,
	Signal,
	Summary,
};
