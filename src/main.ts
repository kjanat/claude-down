#!/usr/bin/env bun
/**
 * claude-down CLI — thin wrapper around the library in `./index.ts`.
 *
 * Usage:
 *   claude-down             → one-line human summary
 *   claude-down -v          → + affected components and live incidents
 *   claude-down --json      → raw status payload
 *   claude-down -q          → silent, exit code only
 *
 * Exit codes:
 *   0  all operational (indicator=none)
 *   1  degraded        (indicator=minor)
 *   2  outage          (indicator=major|critical)
 *   3  unknown         (network or parse error)
 */

import { emoji, exitCodeFor, fetchSummary } from "./index.ts";

const argv = new Set(Bun.argv.slice(2));
const asJson = argv.has("--json");
const quiet = argv.has("-q") || argv.has("--quiet");
const verbose = argv.has("-v") || argv.has("--verbose");

const result = await fetchSummary();

if (result.kind === "unknown") {
  if (asJson) {
    console.log(JSON.stringify({ state: "unknown", reason: result.reason }));
  } else if (!quiet) {
    console.log(`unknown — ${result.reason}`);
  }
  process.exit(3);
}

const { status, components, incidents } = result.summary;
const code = exitCodeFor(status.indicator);

if (asJson) {
  console.log(
    JSON.stringify({
      state: emoji(status.indicator),
      indicator: status.indicator,
      description: status.description,
      incidents: incidents.map((i) => ({ name: i.name, status: i.status, impact: i.impact })),
      affected: components
        .filter((c) => c.status !== "operational")
        .map((c) => ({ name: c.name, status: c.status })),
    }),
  );
} else if (!quiet) {
  console.log(`${emoji(status.indicator)} — ${status.description}`);
  if (verbose) {
    const affected = components.filter((c) => c.status !== "operational");
    if (affected.length > 0) {
      console.log("\naffected components:");
      for (const c of affected) console.log(`  • ${c.name} (${c.status})`);
    }
    if (incidents.length > 0) {
      console.log("\nlive incidents:");
      for (const i of incidents) console.log(`  • ${i.name} [${i.status}, ${i.impact}]`);
    }
  }
}

process.exit(code);
