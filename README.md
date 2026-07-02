# lightscore

Lighthouse scores in your terminal, with concrete fixes for everything below
100, and a Markdown report your coding agent can act on.

```
$ npx lightscore milindmishra.com
Auditing https://milindmishra.com

=== https://milindmishra.com — MOBILE ===
performance: 94  |  accessibility: 100  |  best-practices: 100  |  seo: 100

  Performance gaps:
    - cumulative-layout-shift: 75% (0.152)
    - cache-insight: 50% (Est savings of 5 KiB)
    - cls-culprits-insight: 0%
    - network-dependency-tree-insight: 0%
    - layout-shifts: 0% (2 layout shifts found)

=== https://milindmishra.com — DESKTOP ===
performance: 100  |  accessibility: 100  |  best-practices: 100  |  seo: 100

  Performance gaps:
    - cache-insight: 50% (Est savings of 5 KiB)
    - network-dependency-tree-insight: 0%
```

## Usage

lightscore never starts a server for you, it audits whatever is already running.

```
npx lightscore localhost:3000           # local dev server
npx lightscore milindmishra.com         # bare domain -> https://
npx lightscore milindmishra.com example.com/pricing  # audit several pages in one go
npx lightscore https://example.com --runs 5 --form-factor mobile,desktop --concurrency 2 --out lighthouse-report.md
```

Running `lightscore` with no arguments prints the help.

Then feed the report to an agent:

```
claude "fix the issues in lighthouse-report.md"
```

## Agent usage

[`SKILL.md`](SKILL.md) teaches coding agents how to use lightscore, the
audit → fix → re-audit loop, flag choices, and JSON output for parsing. It
ships with the package; to use it as a Claude Code project skill, link it in:

```
mkdir -p .claude/skills/auditing-lighthouse-scores
ln -s ../../../node_modules/lightscore/SKILL.md .claude/skills/auditing-lighthouse-scores/SKILL.md
```

## Programmatic usage

The CLI is a thin wrapper over the library:

```ts
import { audit } from "lightscore";

const results = await audit(["https://example.com"], {
  formFactors: ["mobile"],
  runs: 3,
  onEvent: (e) => { /* job-start | job-done | job-error */ },
});
```

## Flags

- `<urls...>`, URLs, domains, or `host:port`s to audit (required)
- `-r, --runs <n>`, number of runs to median across (default 3, reduces noise)
- `-f, --form-factor <mobile,desktop>`, which form factors to audit (default both)
- `-c, --concurrency <n>`, Chrome instances auditing in parallel (default 1)
- `-o, --out <file>`, write a Markdown report
- `--json`, print structured results instead of the terminal report

## How it works

- `src/api.ts`, the programmatic core: `audit(targets, options)` fans every
  (URL × form factor) job out over a pool of Chrome instances and reports
  progress as events, so the CLI, CI, or a server can consume it the same way.
- `src/lighthouse-runner.ts`, thin wrapper over the Lighthouse Node API:
  launches Chrome, runs N times, takes the median, and extracts gaps
  (audits scoring below 100%) ranked by weighted impact.
- `src/resolve-target.ts`, normalizes a bare host or domain into a full URL
  (localhost gets `http://`, everything else `https://`).
- `src/knowledge/audit-fixes.json`, a curated map of Lighthouse audit ID →
  why it matters and how to fix it, distilled from web.dev docs and common
  framework fixes. This is what turns a bare score into something
  actionable, extend it as you hit new audit IDs.
- `src/report.ts`, renders terminal output and the Markdown report.

## Extending the knowledge base

Add an entry to `src/knowledge/audit-fixes.json` keyed by the Lighthouse
audit ID (shown in terminal output, e.g. `unused-javascript`):

```json
"audit-id": {
  "why": "One line on why this hurts the score/user.",
  "fix": "Concrete, actionable fix."
}
```
