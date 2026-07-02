// Composable Lighthouse runner. Knows nothing about how the URL is served —
// give it a URL and it audits it. `withChrome` manages a shared Chrome so many
// audits reuse one browser; `runMedian` stabilises scores across noisy runs.
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { computeMedianRun } from "lighthouse/core/lib/median-run.js";
import * as chromeLauncher from "chrome-launcher";
import type * as LH from "lighthouse/types/lh.js";

export type FormFactor = "mobile" | "desktop";

export const DEFAULT_CATEGORIES = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
] as const;

export interface RunOptions {
  port: number;
  categories?: readonly string[];
}

export interface ChromeHandle {
  port: number;
  kill: () => void;
}

export async function withChrome<T>(
  fn: (chrome: ChromeHandle) => Promise<T>,
  chromeFlags: string[] = ["--headless", "--no-sandbox", "--disable-gpu"],
): Promise<T> {
  const chrome = await chromeLauncher.launch({ chromeFlags });
  const handle: ChromeHandle = { port: chrome.port, kill: () => chrome.kill() };
  try {
    return await fn(handle);
  } finally {
    chrome.kill();
  }
}

export async function runOnce(
  url: string,
  formFactor: FormFactor,
  opts: RunOptions,
): Promise<LH.Result> {
  const flags: LH.Flags = {
    port: opts.port,
    logLevel: "silent",
    output: "json",
    onlyCategories: [...(opts.categories ?? DEFAULT_CATEGORIES)],
  };
  const config = formFactor === "desktop" ? desktopConfig : undefined;
  const result = await lighthouse(url, flags, config);
  if (!result?.lhr) throw new Error(`Lighthouse returned no result for ${url}`);
  return result.lhr;
}

export async function runMedian(
  url: string,
  formFactor: FormFactor,
  opts: RunOptions & { runs?: number },
): Promise<LH.Result> {
  const runs = Math.max(1, opts.runs ?? 3);
  const results: LH.Result[] = [];
  for (let i = 0; i < runs; i++) results.push(await runOnce(url, formFactor, opts));
  return runs > 1 ? computeMedianRun(results) : results[0]!;
}

export interface CategoryScores {
  [category: string]: number;
}

export interface AuditGap {
  id: string;
  title: string;
  score: number;
  displayValue?: string;
  weight: number;
}

export interface CategoryGaps {
  key: string;
  title: string;
  gaps: AuditGap[];
}

export function scores(lhr: LH.Result): CategoryScores {
  return Object.fromEntries(
    Object.entries(lhr.categories).map(([k, c]) => [k, Math.round((c.score ?? 0) * 100)]),
  );
}

/**
 * Per-category, the non-informative audits scoring below 100%, sorted by
 * impact (weight in the category score × how far from perfect).
 */
export function gapsByCategory(lhr: LH.Result): CategoryGaps[] {
  const out: CategoryGaps[] = [];
  for (const [key, cat] of Object.entries(lhr.categories)) {
    const gaps: AuditGap[] = [];
    for (const ref of cat.auditRefs) {
      const a = lhr.audits[ref.id];
      if (a && a.score !== null && a.score !== undefined && a.score < 1 && a.scoreDisplayMode !== "informative") {
        gaps.push({
          id: a.id,
          title: a.title,
          score: Math.round(a.score * 100),
          displayValue: a.displayValue,
          weight: ref.weight ?? 0,
        });
      }
    }
    gaps.sort((a, b) => b.weight * (100 - b.score) - a.weight * (100 - a.score));
    if (gaps.length) out.push({ key, title: cat.title, gaps });
  }
  return out;
}
