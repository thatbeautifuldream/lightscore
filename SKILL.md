---
name: auditing-lighthouse-scores
description: Runs Lighthouse audits against one or more URLs with the lightscore CLI and returns scores plus ranked, actionable fixes for everything below 100. Use when asked to audit page performance, accessibility, SEO, or best practices, check Lighthouse scores, or generate a performance report for a local dev server or live site.
---

# Auditing Lighthouse scores with lightscore

lightscore audits already-running pages — it never starts a server. Make sure the target is reachable before auditing (start the dev server yourself if needed).

## Quick start

```bash
npx lightscore <url>
```

Targets are normalized automatically: `localhost:3000` → `http://localhost:3000`, `example.com/pricing` → `https://example.com/pricing`. Full URLs pass through as-is. Multiple targets can be given in one call.

## Common invocations

```bash
npx lightscore localhost:3000                       # local dev server, mobile + desktop
npx lightscore example.com --form-factor mobile     # one form factor only
npx lightscore example.com --runs 5                 # more runs = less noise (default 3, median taken)
npx lightscore a.com b.com --concurrency 2          # parallel Chrome instances
npx lightscore example.com --out report.md          # write a markdown report
npx lightscore example.com --json                   # structured output for programmatic use
```

## Agent workflow

1. Confirm the target responds (e.g. `curl -sI <url>`); start the dev server first if auditing local work.
2. Run `npx lightscore <url> --json --out report.md` — JSON for parsing, markdown for humans.
3. Read the gaps: each result lists audits scoring below 100, ranked by weighted impact, with why-it-matters and how-to-fix guidance.
4. Apply fixes starting from the highest-impact gaps, then re-run the same command to verify scores improved.

## Output

- Terminal report: per-URL, per-form-factor category scores (performance, accessibility, best practices, SEO) with ranked gaps and fixes.
- `--json`: array of `{ url, formFactor, scores, gaps }` objects.
- `--out <file>`: markdown report suitable for feeding to a coding agent.

## Programmatic use

For Node.js callers, import the library instead of shelling out:

```ts
import { audit } from "lightscore";

const results = await audit(["https://example.com"], {
  formFactors: ["mobile"],
  runs: 3,
  onEvent: (e) => { /* job-start | job-done | job-error */ },
});
```

## Notes

- Requires Chrome/Chromium on the machine (launched headlessly per worker).
- Audits are slow (~30–60s per URL × form factor × runs); prefer one form factor and default runs while iterating, full matrix for final reports.
- Individual job failures are skipped; the command only fails if every job fails.
