# claude-down

**Is Claude down? Again?**

> A tiny CLI tool to check if Claude is operational, combining official status
> reports with community signals.

`claude-down` monitors two sources in parallel:

1. **Anthropic Status Page** (`status.claude.com`): The authoritative source for
   incident reports and component status.
2. **Downdetector**: Community-driven signal that often leads official reports
   by several minutes.

Claude Fable 5 access is suspended right now — check if it's back:

```bash
npx -y claude-down@latest --fable
```

## Installation

You can run it directly using `bunx` or `npx`:

```bash
bunx claude-down status
# or
npx -y claude-down status
```

Or install it globally:

```bash
bun install -g claude-down
# or
npm install -g claude-down
```

<details>
<summary>Preview (continuous) releases</summary>

Every commit and PR is published to [pkg.pr.new]; the bot comments the exact URL
on each PR. Run a preview build with any runner:

```bash
bunx https://pkg.pr.new/kjanat/claude-down@<sha> status   # or npx / pnpx
```

</details>

## Usage

### Human-readable summary

The `status` command provides a status indicator, a brief description, and
details from both sources.

```bash
claude-down status
```

### JSON output

Get structured data for scripts or monitoring tools.

```bash
claude-down status --json
```

### Exit code only

The exit code always reflects the worst status found (see [Exit Codes](#exit-codes)),
whether or not output is rendered. Use `-q`/`--quiet` in CI/CD or shell scripts
to suppress the report and rely on the exit code alone.

```bash
claude-down status -q
```

### Specific source

Check a specific source using subcommands or the `--source` flag. `--source`
accepts comma-separated values and/or repeated flags.

```bash
# Using subcommands
claude-down anthropic
claude-down downdetector

# Using flags
claude-down status --source anthropic
claude-down status -s downdetector

# Multiple sources
claude-down status --source anthropic,downdetector
claude-down status -s anthropic -s downdetector
```

### Filter by model

Narrow incidents and components to those naming specific model families. The
summary and exit code then reflect only the selected models, so you can alert on
just the ones you depend on. Like `--source`, `--model` accepts comma-separated
values and/or repeated flags; each model also has a convenience flag.

```bash
# Convenience flags
claude-down status --opus --sonnet

# --model with comma-separated and/or repeated values
claude-down status --model opus,sonnet
claude-down status -m opus -m sonnet
```

Available models: `opus`, `haiku`, `sonnet`, `mythos`, `fable`.

## Browser Usage

`claude-down` provides a browser-safe entry point that only includes the
Anthropic Statuspage source (since Downdetector requires a local Chromium
binary).

```typescript
import { checkAnthropic } from "claude-down/browser";

const result = await checkAnthropic();

if (result.kind === "ok") {
  console.log(result.summary.status.description);
  console.log(result.summary.status.indicator);
  console.log(result.summary.incidents);
  console.log(result.summary.components);
} else {
  console.error(result.reason);
}
```

## Exit Codes

The CLI returns specific exit codes based on the severity of the outage. The
code is set on every run (not only with `--quiet`) and reflects the most severe
status across the checked sources.

|   Code | Status      | Description                                                   |
| -----: | :---------- | :------------------------------------------------------------ |
|  **0** | Operational | Everything is working normally.                               |
|  **1** | Degraded    | Minor issue, or an active Anthropic incident.                 |
|  **2** | Outage      | Major/critical outage or Downdetector reports Claude is down. |
| **21** | Unknown     | Every checked source was unreachable.                         |

An unreachable source is treated as _unknown_, not _down_: code `21` is only
returned when **all** selected sources are unreachable, so a flaky Downdetector
scrape never masks an otherwise-operational result.

## Development

This project is built with [dreamcli].

### Setup

```bash
bun install
```

### Build

```bash
bun run build
```

### Test

```bash
bun test
```

## License

[MIT][LICENSE] © 2026 Kaj Kowalski

[LICENSE]: https://github.com/kjanat/claude-down/blob/master/LICENSE
[dreamcli]: https://github.com/kjanat/dreamcli
[pkg.pr.new]: https://pkg.pr.new
