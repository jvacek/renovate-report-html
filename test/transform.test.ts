import { describe, expect, it } from "vitest";
import { toProblem, toReportData } from "../src/report/data.ts";
import { parseReport } from "../src/report/schema.ts";
import { allDeps, packageIndex, staleness, summarize, versionCounts } from "../src/report/stats.ts";
import { fullReport, lookupData } from "./helpers.ts";

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

  it("stringifies and truncates structured problem context", () => {
    const problem = toProblem({
      msg: "x",
      level: 50,
      details: { a: 1 },
      long: "y".repeat(600),
    });
    expect(problem.context.details).toBe('{"a":1}');
    expect(problem.context.long).toHaveLength(501);
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
    const names = [...allDeps(toReportData(report).repositories)].map((ref) => ref.dep.name);
    expect(names).toEqual(["only-pkg", "(unnamed)"]);
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
