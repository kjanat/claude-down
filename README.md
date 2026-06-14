# claude-down

[![NPM Version](https://img.shields.io/npm/v/claude-down?logo=npm&labelColor=CB3837&color=black)](https://www.npmjs.com/package/claude-down)
[![pkg.pr.new](https://pkg.pr.new/badge/kjanat/claude-down)](https://pkg.pr.new/~/kjanat/claude-down)

is claude down (again) (yes). booga check, you no cry.

claude no work? maybe you. maybe anthropic. (probably anthropic.) booga look two
place same time:

- **status.claude.com** — what anthropic admit to.
- **Downdetector** — what everyone else screaming about, usually first.

fable 5 cooked rn (anthropic suspend access). it back yet??

```bash
npx -y claude-down@latest --fable
```

## or just watch the page

no install, no terminal. page poll itself, you stare:

<https://kjanat.github.io/claude-down/>

## get booga

run direct, no install:

```bash
bunx claude-down status
# or
npx -y claude-down status
```

or keep forever:

```bash
bun install -g claude-down
# or
npm install -g claude-down
```

<details>
<summary>fresh builds (every commit)</summary>

every push + PR get published to [pkg.pr.new]. bot drop the url in the PR. run
any sha:

```bash
bunx https://pkg.pr.new/kjanat/claude-down@<sha> status   # or npx / pnpx
```

</details>

## how use

### words for human

`status` give indicator, lil description, details from both place.

```bash
claude-down status
```

### words for robot

json for your scripts and your little monitoring guys.

```bash
claude-down status --json
```

### no words, just number

exit code always tell truth (see [the numbers](#the-numbers)), output or not.
slap `-q`/`--quiet` in CI when you only care about number.

```bash
claude-down status -q
```

### pick your place

subcommand or `--source`. `--source` eat commas and repeats.

```bash
# subcommand
claude-down anthropic
claude-down downdetector

# flag
claude-down status --source anthropic
claude-down status -s downdetector

# many
claude-down status --source anthropic,downdetector
claude-down status -s anthropic -s downdetector
```

### pick your model

only show incident/component that name model you care about. summary AND exit
code shrink to just those. like `--source`, `--model` eat commas and repeats,
and every model got shortcut flag.

```bash
# shortcut
claude-down status --opus --sonnet

# --model, commas and/or repeats
claude-down status --model opus,sonnet
claude-down status -m opus -m sonnet
```

models: `opus`, `haiku`, `sonnet`, `mythos`, `fable`.

## use in browser

browser-safe door, anthropic only (downdetector need real chromium, no work in
browser).

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

## the numbers

exit code = how bad. set every run (not just `--quiet`), worst source win.

|   Code | Vibe      | what happen                                             |
| -----: | :-------- | :------------------------------------------------------ |
|  **0** | all good  | everything work. go back to your life.                  |
|  **1** | meh       | minor thing, or anthropic got live incident.            |
|  **2** | cooked    | major/critical outage, or downdetector say claude down. |
| **21** | who knows | every source booga try was unreachable.                 |

source booga no reach = unknown, NOT down. `21` only when EVERY source dead, so
one flaky downdetector scrape no ruin your day.

## who do all this

booga no write flag parser. booga no write `--help`, tab-complete, json mode,
exit codes. all that [dreamcli]. booga just point at anthropic and shitpost.

you want make own CLI look this clean? → [dreamcli]

## hack on it

```bash
bun install   # setup
bun run build # build
bun test      # test
```

## license

[MIT][LICENSE] © 2026 Kaj Kowalski

[LICENSE]: https://github.com/kjanat/claude-down/blob/master/LICENSE
[dreamcli]: https://github.com/kjanat/dreamcli
[pkg.pr.new]: https://pkg.pr.new
