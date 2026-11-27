import { describe, expect, it } from "vitest";
import { hasOpenChanges, isOpenChange, openChanges, openChangesByUse } from "../src/report/changes.ts";
import { toReportData } from "../src/report/data.ts";
import { parseReport } from "../src/report/schema.ts";
import { allDeps } from "../src/report/stats.ts";
import { fullReport, lookupData } from "./helpers.ts";

/** A full-run report where Renovate has an open PR for the first branch of expressjs/express. */
function reportWithOpenPr() {
  const raw = fullReport() as {
    repositories: Record<string, { branches: { prNo?: number | null; result?: string }[] }>;
  };
  const branches = raw.repositories["expressjs/express"]?.branches ?? [];
  Object.assign(branches[0] ?? {}, { prNo: 42, result: "done" });
  Object.assign(branches[1] ?? {}, { prNo: 7, result: "already-existed" });
  return toReportData(parseReport(raw));
}

describe("isOpenChange", () => {
  it.each([
    [{ prNo: 3, result: "done" }, true],
    [{ prNo: 3, result: "pr-edited" }, true],
    [{ prNo: 3, result: "already-existed" }, false],
    [{ prNo: null, result: "no-work" }, false],
    [{ result: "pending" }, false],
  ])("%o -> %s", (branch, expected) => {
    expect(isOpenChange({ branchName: "renovate/x", upgrades: [], ...branch })).toBe(expected);
  });
});

describe("open changes", () => {
  const data = reportWithOpenPr();
  const express = data.repositories.find((r) => r.name === "expressjs/express");

  it("lists open PRs per repository and skips closed ones", () => {
    expect(express && openChanges(express).map((c) => c.branch.prNo)).toEqual([42]);
  });

  it("finds the PR for each dependency it updates", () => {
    const changesFor = openChangesByUse(data.repositories);
    const upgrades = express?.branches.find((b) => b.prNo === 42)?.upgrades ?? [];
    expect(upgrades.length).toBeGreaterThan(0);
    const updated = [...allDeps(data.repositories)].filter((ref) => changesFor(ref).length > 0);
    expect(updated.length).toBeGreaterThan(0);
    for (const ref of updated) {
      expect(ref.repo).toBe("expressjs/express");
      expect(changesFor(ref).map((c) => c.branch.prNo)).toEqual([42]);
      expect(upgrades.some((u) => u.packageFile === ref.packageFile)).toBe(true);
    }
  });

  it("knows when a report has open changes", () => {
    expect(hasOpenChanges(data.repositories)).toBe(true);
    // Branches, but none with an open PR.
    expect(hasOpenChanges(toReportData(parseReport(fullReport())).repositories)).toBe(false);
    expect(hasOpenChanges(lookupData().repositories)).toBe(false);
  });
});
