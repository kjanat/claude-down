/**
 * claude-down — tell if Claude is down, per Anthropic's official status page.
 *
 * Library entry: types and pure functions for fetching and interpreting the
 * Anthropic Statuspage summary. The CLI lives in `./main.ts`.
 *
 * Source: https://status.claude.com/api/v2/summary.json  (Statuspage.io format)
 */

export const STATUS_URL = "https://status.claude.com/api/v2/summary.json";

export type Indicator = "none" | "minor" | "major" | "critical";

export type Component = {
  name: string;
  status:
    | "operational"
    | "degraded_performance"
    | "partial_outage"
    | "major_outage"
    | "under_maintenance";
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
  | { kind: "ok"; summary: Summary }
  | { kind: "unknown"; reason: string };

export async function fetchSummary(): Promise<Result> {
  let res: Response;
  try {
    res = await fetch(STATUS_URL, { redirect: "follow" });
  } catch (e) {
    return { kind: "unknown", reason: `fetch failed: ${(e as Error).message}` };
  }
  if (!res.ok) return { kind: "unknown", reason: `HTTP ${res.status}` };

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { kind: "unknown", reason: "invalid JSON" };
  }

  if (!isSummary(data)) return { kind: "unknown", reason: "unexpected payload shape" };
  return { kind: "ok", summary: data };
}

export function isSummary(v: unknown): v is Summary {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  const s = o.status as Record<string, unknown> | undefined;
  return (
    typeof s === "object"
    && s !== null
    && typeof s.indicator === "string"
    && typeof s.description === "string"
    && Array.isArray(o.components)
    && Array.isArray(o.incidents)
  );
}

export function exitCodeFor(indicator: Indicator): 0 | 1 | 2 {
  switch (indicator) {
    case "none":
      return 0;
    case "minor":
      return 1;
    case "major":
    case "critical":
      return 2;
  }
}

export function emoji(indicator: Indicator): string {
  return indicator === "none" ? "up" : indicator === "minor" ? "degraded" : "down";
}
