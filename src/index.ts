export { audit, type AuditOptions, type AuditEvent, type TargetResult } from "./api.ts";
export {
  withChrome,
  runOnce,
  runMedian,
  scores,
  gapsByCategory,
  DEFAULT_CATEGORIES,
  type FormFactor,
  type RunOptions,
  type ChromeHandle,
  type CategoryScores,
  type CategoryGaps,
  type AuditGap,
} from "./lighthouse-runner.ts";
export { resolveTarget } from "./resolve-target.ts";
export { terminalReport, toMarkdown } from "./report.ts";
