import { describe, expect, it } from "vitest";
import {
  allHeldBackChanges,
  allOpenChanges,
  describeLimit,
  hasOpenChanges,
  heldBackBy,
  heldBackByUse,
  isOpenChange,
  openChanges,
  openChangesByUse,
  upgradesByType,
} from "../src/report/changes.ts";
import { toReportData } from "../src/report/data.ts";
import { parseReport } from "../src/report/schema.ts";
import { allDeps } from "../src/report/stats.ts";
import { fullReport, lookupData } from "./helpers.ts";

/**
 * A full-run report for expressjs/express where Renovate has an open PR for the first branch, a
 * closed one for the second, one held back by the branch limit, and an open PR it didn't update
 * because of the hourly commit limit.
 */
function reportWithOpenPr() {
  const raw = fullReport() as {
    repositories: Record<string, { branches: { prNo?: number | null; result?: string }[] }>;
  };
  const branches = raw.repositories["expressjs/express"]?.branches ?? [];
  Object.assign(branches[0] ?? {}, { prNo: 42, result: "done" });
  Object.assign(branches[1] ?? {}, { prNo: 7, result: "already-existed" });
  Object.assign(branches[2] ?? {}, { prNo: null, result: "branch-limit-reached" });
  Object.assign(branches[3] ?? {}, { prNo: 9, result: "commit-hourly-limit-reached" });
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

describe("heldBackBy", () => {
  it.each([
    [{ result: "branch-limit-reached" }, "branch"],
    [{ prNo: null, result: "pr-limit-reached" }, "pr"],
    [{ result: "commit-hourly-limit-reached" }, "commit-hourly"],
    [{ result: "commit-per-run-limit-reached" }, "commit-per-run"],
    [{ prNo: 3, result: "commit-hourly-limit-reached" }, undefined],
    [{ result: "no-work" }, undefined],
    [{}, undefined],
  ])("%o -> %s", (branch, expected) => {
    expect(heldBackBy({ branchName: "renovate/x", upgrades: [], ...branch })).toBe(expected);
  });

  it("names the PR limit the way the platform does", () => {
    expect(describeLimit("pr", "MR").label).toBe("MR limit");
  });
});

describe("upgradesByType", () => {
  it("counts upgrades per update type, unknown when Renovate gave none", () => {
    const branch = {
      branchName: "renovate/x",
      upgrades: [{ updateType: "minor" }, { updateType: "minor" }, { updateType: "patch" }, {}],
    };
    expect(upgradesByType(branch)).toEqual({
      minor: 2,
      patch: 1,
      unknown: 1,
    });
  });
});

describe("open changes", () => {
  const data = reportWithOpenPr();
  const express = data.repositories.find((r) => r.name === "expressjs/express");

  it("lists open PRs per repository and skips closed ones", () => {
    expect(express && openChanges(express).map((c) => c.branch.prNo)).toEqual([42, 9]);
  });

  it("lists open PRs across all repositories", () => {
    expect(allOpenChanges(data.repositories).map((c) => [c.repo.name, c.branch.prNo])).toEqual([
      ["expressjs/express", 42],
      ["expressjs/express", 9],
    ]);
    expect(allOpenChanges(lookupData().repositories)).toEqual([]);
  });

  it("lists the changes a limit held back, and finds them for the dependencies they update", () => {
    const held = allHeldBackChanges(data.repositories);
    expect(held.map((c) => [c.repo.name, c.limit])).toEqual([["expressjs/express", "branch"]]);
    const heldFor = heldBackByUse(data.repositories);
    const updated = [...allDeps(data.repositories)].filter((ref) => heldFor(ref).length > 0);
    expect(updated.length).toBeGreaterThan(0);
    for (const ref of updated) expect(heldFor(ref)).toEqual(held);
    expect(allHeldBackChanges(lookupData().repositories)).toEqual([]);
  });

  it("finds the PR for each dependency it updates", () => {
    const changesFor = openChangesByUse(data.repositories);
    const updated = [...allDeps(data.repositories)].filter((ref) => changesFor(ref).length > 0);
    expect(new Set(updated.flatMap((ref) => changesFor(ref).map((c) => c.branch.prNo)))).toEqual(new Set([42, 9]));
    for (const ref of updated) {
      expect(ref.repo).toBe("expressjs/express");
      for (const change of changesFor(ref)) {
        expect(change.branch.upgrades.some((u) => u.packageFile === ref.packageFile)).toBe(true);
      }
    }
  });

  it("knows when a report has open changes", () => {
    expect(hasOpenChanges(data.repositories)).toBe(true);
    // Branches, but none with an open PR.
    expect(hasOpenChanges(toReportData(parseReport(fullReport())).repositories)).toBe(false);
    expect(hasOpenChanges(lookupData().repositories)).toBe(false);
  });
});
