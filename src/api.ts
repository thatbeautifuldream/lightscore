// Programmatic entry point. One call audits any number of targets across any
// number of form factors, fanning jobs out over a pool of Chrome instances.
// Progress is surfaced as events so callers (CLI, CI, servers) render it
// however they like — the core never writes to stdout.
import {
  withChrome,
  runMedian,
  scores,
  gapsByCategory,
  DEFAULT_CATEGORIES,
  type FormFactor,
  type CategoryScores,
  type CategoryGaps,
} from "./lighthouse-runner.ts";

export interface TargetResult {
  url: string;
  formFactor: FormFactor;
  scores: CategoryScores;
  gaps: CategoryGaps[];
}

export type AuditEvent =
  | { type: "job-start"; url: string; formFactor: FormFactor }
  | { type: "job-done"; result: TargetResult }
  | { type: "job-error"; url: string; formFactor: FormFactor; error: Error };

export interface AuditOptions {
  formFactors?: FormFactor[];
  categories?: readonly string[];
  runs?: number;
  /** Number of Chrome instances auditing in parallel (default 1). */
  concurrency?: number;
  onEvent?: (event: AuditEvent) => void;
}

interface Job {
  url: string;
  formFactor: FormFactor;
}

/**
 * Audit every (url × form factor) combination and return results in job
 * order. Individual job failures are reported via `onEvent` and omitted from
 * the result; the call only rejects if every job fails.
 */
export async function audit(
  targets: string[],
  opts: AuditOptions = {},
): Promise<TargetResult[]> {
  const formFactors = opts.formFactors ?? ["mobile", "desktop"];
  const runs = Math.max(1, opts.runs ?? 3);
  const categories = opts.categories ?? DEFAULT_CATEGORIES;
  const emit = opts.onEvent ?? (() => {});

  const jobs: Job[] = targets.flatMap((url) =>
    formFactors.map((formFactor) => ({ url, formFactor })),
  );
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 1, jobs.length));

  const results: (TargetResult | undefined)[] = new Array(jobs.length);
  const errors: Error[] = [];
  let next = 0;

  const worker = () =>
    withChrome(async ({ port }) => {
      while (next < jobs.length) {
        const index = next++;
        const { url, formFactor } = jobs[index]!;
        emit({ type: "job-start", url, formFactor });
        try {
          const lhr = await runMedian(url, formFactor, { port, runs, categories });
          const result: TargetResult = {
            url,
            formFactor,
            scores: scores(lhr),
            gaps: gapsByCategory(lhr),
          };
          results[index] = result;
          emit({ type: "job-done", result });
        } catch (e) {
          const error = e instanceof Error ? e : new Error(String(e));
          errors.push(error);
          emit({ type: "job-error", url, formFactor, error });
        }
      }
    });

  await Promise.all(Array.from({ length: concurrency }, worker));

  const ok = results.filter((r): r is TargetResult => r !== undefined);
  if (!ok.length && errors.length) {
    throw new Error(`All ${jobs.length} audit(s) failed: ${errors[0]!.message}`);
  }
  return ok;
}
