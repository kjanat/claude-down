# claude-down

**Is Claude down? Again?**

> A tiny CLI tool to check if Claude is operational, combining official status reports with community signals.

`claude-down` monitors two sources in parallel:

1. **Anthropic Status Page** (`status.claude.com`): The authoritative source for incident reports and component status.
2. **Downdetector**: Community-driven signal that often leads official reports by several minutes.

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

## Usage

### Human-readable summary

The `status` command provides a status indicator, a brief description, and details from both sources.

```bash
claude-down status
```

### JSON output

Get structured data for scripts or monitoring tools.

```bash
claude-down status --json
```

### Silent mode

Use for CI/CD or shell scripts where you only care about the exit code.

```bash
claude-down status -q
```

### Specific source

You can check a specific source using subcommands or the `--source` flag.

```bash
# Using subcommands
claude-down anthropic
claude-down downdetector

# Using flags
claude-down status --source anthropic
# or
claude-down status -s downdetector
```

## Browser Usage

`claude-down` provides a browser-safe entry point that only includes the Anthropic Statuspage source (since Downdetector requires a local Chromium binary).

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

The CLI returns specific exit codes based on the severity of the outage:

|   Code | Status      | Description                                                   |
| -----: | :---------- | :------------------------------------------------------------ |
|  **0** | Operational | Everything is working normally.                               |
|  **1** | Degraded    | Minor issues reported by Anthropic.                           |
|  **2** | Outage      | Major/critical outage or Downdetector reports Claude is down. |
| **21** | Unknown     | Both status sources are unreachable.                          |

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
