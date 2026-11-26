import { readFileSync } from "node:fs";
import { toReportData } from "../src/report/data.ts";
import { parseReport } from "../src/report/schema.ts";

export function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8"));
}

/** Generated with --dry-run=lookup: no branch data. */
export const lookupReport = () => readFixture("github-report");
/** Generated with --dry-run=full: includes branches and repository metadata. */
export const fullReport = () => readFixture("github-report-full");

export const lookupData = () => toReportData(parseReport(lookupReport()), { generatedAt: new Date(0) });
