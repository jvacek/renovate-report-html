import { describe, expect, it } from "vitest";
import { toProblem, toReportData } from "../src/report/data.ts";
import { parseReport } from "../src/report/schema.ts";
import {
  allDeps,
  isBehind,
  newestInUse,
  packageIndex,
  staleness,
  summarize,
  versionCounts,
} from "../src/report/stats.ts";
import { fullReport, lookupData, readFixture } from "./helpers.ts";

/** The deps of a single package file, as the viewer gets them. */
function depsOf(deps: unknown[]) {
  const report = parseReport({ repositories: { "a/b": { packageFiles: { npm: [{ packageFile: "p", deps }] } } } });
  return [...allDeps(toReportData(report).repositories)].map((ref) => ref.dep);
}

describe("toReportData", () => {
  const data = lookupData();

  it("sorts repositories and managers by name", () => {
    expect(data.repositories.map((r) => r.name)).toEqual([
      "docker-library/hello-world",
      "expressjs/express",
      "oapi-codegen/oapi-codegen",
      "pallets/flask",
      "renovatebot/github-action",
    ]);
    const express = data.repositories.find((r) => r.name === "expressjs/express");
    expect(express?.managers.map((m) => m.name)).toEqual(["github-actions", "npm"]);
  });

  it("carries over title, timestamp and libyears", () => {
    expect(data.title).toBe("Renovate report");
    expect(data.generatedAt).toBe("1970-01-01T00:00:00.000Z");
    expect(data.repositories.find((r) => r.name === "pallets/flask")?.dependencyStatus).toEqual({
      outdated: 29,
      total: 66,
    });
  });

  it("handles reports without branch data", () => {
    expect(data.repositories.every((r) => r.branches.length === 0)).toBe(true);
  });

  it("keeps branches and repository metadata from a full run", () => {
    const full = toReportData(parseReport(fullReport()));
    const express = full.repositories.find((r) => r.name === "expressjs/express");
    expect(express).toMatchObject({
      platform: "github",
      defaultBranch: "master",
      status: "onboarded",
    });
    expect(express?.branches.length).toBeGreaterThan(0);
    expect(express?.branches[0]).toMatchObject({
      branchName: expect.stringMatching(/^renovate\//),
    });
  });

  it("turns problems into a message plus readable context", () => {
    expect(data.problems).toHaveLength(1);
    const problem = data.problems[0];
    expect(problem?.level).toBe(40);
    expect(problem?.context).toHaveProperty("documentationUrl");
    expect(problem?.context).not.toHaveProperty("logContext");
    expect(problem?.context).not.toHaveProperty("name");
  });

  it("truncates long scalar problem context", () => {
    const problem = toProblem({ msg: "x", level: 50, count: 3, long: "y".repeat(600) });
    expect(problem.context.count).toBe("3");
    expect(problem.context.long).toHaveLength(501);
    expect(problem.payloads).toEqual([]);
  });

  it("keeps structured problem fields as pretty-printed payloads", () => {
    const problem = toProblem({
      msg: "x",
      err: { name: "HTTPError", message: "404", stack: "y".repeat(600) },
      details: { a: 1, b: 2 },
      list: [1],
    });
    expect(problem.context).toEqual({});
    expect(problem.payloads).toEqual([
      { key: "err", summary: "HTTPError: 404", json: expect.stringContaining(`"stack": "${"y".repeat(600)}"`) },
      { key: "details", summary: "{ a, b }", json: '{\n  "a": 1,\n  "b": 2\n}' },
      { key: "list", summary: "[1 item]", json: "[\n  1\n]" },
    ]);
  });

  it("names deps by depName, falling back to packageName", () => {
    const report = parseReport({
      repositories: {
        "a/b": {
          packageFiles: {
            npm: [{ packageFile: "p", deps: [{ packageName: "only-pkg" }, {}] }],
          },
        },
      },
    });
    const deps = [...allDeps(toReportData(report).repositories)].map((ref) => ref.dep);
    expect(deps.map((d) => [d.name, d.unnamed])).toEqual([
      ["only-pkg", undefined],
      ["(unnamed)", true],
    ]);
  });

  it("names unnamed deps by the text found in the file, and drops that text otherwise", () => {
    const deps = depsOf([
      { replaceString: "$PROXY/alpine:3", skipReason: "contains-variable" },
      { depName: "alpine", replaceString: "alpine:3" },
    ]);
    expect(deps[0]).toMatchObject({ name: "$PROXY/alpine:3", unnamed: true });
    expect(deps[1]).toEqual({ name: "alpine", updates: [], warnings: [] });
  });

  it("keeps each variable reference in the gitlab fixture apart", () => {
    const data = toReportData(parseReport(readFixture("gitlab-report-full")));
    const unnamed = [...allDeps(data.repositories)].filter((ref) => ref.dep.unnamed);
    expect(unnamed.length).toBeGreaterThan(0);
    expect(unnamed.every((ref) => ref.dep.name.includes("$"))).toBe(true);
  });

  it("normalises object warnings to strings", () => {
    const report = parseReport({
      repositories: {
        "a/b": {
          packageFiles: {
            npm: [
              {
                packageFile: "p",
                deps: [
                  {
                    depName: "d",
                    warnings: [{ topic: "t", message: "boom" }, "plain"],
                  },
                ],
              },
            ],
          },
        },
      },
    });
    expect([...allDeps(toReportData(report).repositories)][0]?.dep.warnings).toEqual(["boom", "plain"]);
  });
});

describe("summarize", () => {
  it("counts deps, updates, skip reasons and problems across the fixture", () => {
    const summary = summarize(lookupData());
    expect(summary).toMatchObject({ repositories: 5, deps: 527, problems: 6 });
    expect(summary.updatesByType).toEqual({ major: 48, minor: 25, patch: 26 });
    expect(summary.skippedByReason).toMatchObject({
      disabled: 194,
      "unspecified-version": 56,
      "local-dependency": 2,
    });
  });
});

describe("packageIndex", () => {
  const packages = packageIndex(lookupData().repositories);

  it("groups a package across repositories", () => {
    const checkout = packages.find((p) => p.id === "github-tags:actions/checkout");
    expect(checkout?.repos).toHaveLength(5);
    expect(checkout?.latest).toBe("v7.0.1");
  });

  it("counts uses per version, most used first", () => {
    const checkout = packages.find((p) => p.id === "github-tags:actions/checkout");
    const counts = checkout ? versionCounts(checkout) : [];
    expect(counts.map((c) => c.version)).toEqual(["v7.0.1", "v4.4.0"]);
    expect(counts.reduce((n, c) => n + c.uses, 0)).toBe(checkout?.usages.length);
    expect(counts.at(-1)?.repos).toEqual(["docker-library/hello-world"]);
  });

  it("marks less common versions as outliers, but never the latest", () => {
    const dep = (version: string, newVersion?: string) => ({
      depName: "pkg",
      datasource: "npm",
      currentVersion: version,
      updates: newVersion ? [{ newVersion, updateType: "minor" }] : [],
    });
    const report = parseReport({
      repositories: {
        "a/b": {
          packageFiles: {
            npm: [{ packageFile: "p", deps: [dep("1.0.0", "2.0.0"), dep("1.0.0", "2.0.0"), dep("1.1.0", "2.0.0")] }],
          },
        },
        "c/d": { packageFiles: { npm: [{ packageFile: "p", deps: [dep("2.0.0")] }] } },
      },
    });
    const [pkg] = packageIndex(toReportData(report).repositories);
    const outliers = pkg ? versionCounts(pkg).map((v) => [v.version, v.outlier]) : [];
    expect(outliers).toEqual([
      ["1.0.0", false],
      ["2.0.0", false],
      ["1.1.0", true],
    ]);
  });

  it("marks uses behind the newest version in use", () => {
    const checkout = packages.find((p) => p.id === "github-tags:actions/checkout");
    const newest = checkout && newestInUse(checkout);
    expect(newest).toBe("v7.0.1");
    const behind = checkout?.usages.filter(({ dep }) => isBehind(dep, newest)) ?? [];
    expect(behind.length).toBe(checkout && versionCounts(checkout).at(-1)?.uses);
    expect(new Set(behind.map((u) => u.repo))).toEqual(new Set(["docker-library/hello-world"]));
  });

  it("marks nothing when all uses are on one version", () => {
    const single = packages.find((p) => versionCounts(p).length === 1);
    expect(single && newestInUse(single)).toBeUndefined();
  });

  it("puts the most widely used packages first", () => {
    expect(packages[0]?.repos.length).toBe(Math.max(...packages.map((p) => p.repos.length)));
  });
});

describe("staleness", () => {
  it.each([
    [undefined, "unknown"],
    [0, "fresh"],
    [89, "fresh"],
    [90, "aging"],
    [364, "aging"],
    [365, "stale"],
    [730, "ancient"],
  ] as const)("buckets %s days as %s", (days, expected) => {
    expect(staleness(days)).toBe(expected);
  });
});
