/**
 * Shared public types for claude-down.
 *
 * `Summary` / `Component` / `Incident` mirror the Statuspage.io shape used by
 * status.claude.com. `Signal` is our internal per-source health result, OR'd
 * by the CLI. `Result` wraps `fetchSummary`'s success/unknown outcomes.
 */

export const INDICATORS = ['none', 'minor', 'major', 'critical'] as const;
export type Indicator = typeof INDICATORS[number];

export type Component = {
	name: string;
	status:
		| 'operational'
		| 'degraded_performance'
		| 'partial_outage'
		| 'major_outage'
		| 'under_maintenance';
};

export type Incident = {
	name: string;
	status: string;
	impact: Indicator;
	shortlink?: string;
};

export type Summary = {
	status: { indicator: Indicator; description: string };
	components: Component[];
	incidents: Incident[];
};

export type Result =
	| { kind: 'ok'; summary: Summary }
	| { kind: 'unknown'; reason: string };

/** Per-source health signal. OR'd by the CLI to produce an overall state. */
export type Signal =
	| { ok: true; down: false }
	| { ok: true; down: true; reason: string }
	| { ok: false; error: string };
