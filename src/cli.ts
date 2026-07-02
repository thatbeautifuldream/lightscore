#!/usr/bin/env node
// lightscore: Lighthouse scores in your terminal, with concrete fixes for
// everything below 100 — and a markdown report your coding agent can act on.
//
// Audits whatever is already running — it never starts a server for you.
//
// Usage:
//   lightscore localhost:3000
//   lightscore milindmishra.com example.com/pricing
//   lightscore https://example.com --runs 5 --form-factor mobile,desktop --concurrency 2 --out report.md
import { writeFile } from "node:fs/promises";
import { Command } from "commander";
import type { FormFactor } from "./lighthouse-runner.ts";
import { audit } from "./api.ts";
import { resolveTarget } from "./resolve-target.ts";
import { terminalReport, toMarkdown } from "./report.ts";

const program = new Command()
  .name("lightscore")
  .description("Lighthouse scores in your terminal, with fixes for everything below 100.")
  .argument("<urls...>", "URLs, domains, or host:ports to audit")
  .option("-r, --runs <n>", "number of runs to median across", "3")
  .option("-f, --form-factor <list>", "comma-separated: mobile,desktop", "mobile,desktop")
  .option("-c, --concurrency <n>", "Chrome instances auditing in parallel", "1")
  .option("-o, --out <file>", "write a markdown report to this path")
  .option("--json", "print results as JSON instead of the terminal report");

if (!process.argv.slice(2).length) program.help();
program.parse(process.argv);

const opts = program.opts<{
  runs: string;
  formFactor: string;
  concurrency: string;
  out?: string;
  json?: boolean;
}>();

async function main() {
  const urls = program.args.map(resolveTarget);

  if (!opts.json) console.log(`Auditing ${urls.join(", ")}`);

  const results = await audit(urls, {
    formFactors: opts.formFactor.split(",").map((s) => s.trim()) as FormFactor[],
    runs: Math.max(1, Number(opts.runs) || 3),
    concurrency: Math.max(1, Number(opts.concurrency) || 1),
    onEvent: (e) => {
      if (opts.json) return;
      if (e.type === "job-done") console.log(terminalReport(e.result));
      if (e.type === "job-error") {
        console.error(`✗ ${e.url} (${e.formFactor}): ${e.error.message}`);
      }
    },
  });

  if (opts.json) console.log(JSON.stringify(results, null, 2));

  if (opts.out) {
    await writeFile(opts.out, toMarkdown(results));
    console.log(`\nWrote ${opts.out}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
