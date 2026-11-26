/** Every committed fixture, one per supported platform, must parse, transform and aggregate. */
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toReportData } from "../src/report/data.ts";
import { parseReport } from "../src/report/schema.ts";
import { allDeps, packageIndex, summarize } from "../src/report/stats.ts";
import { readFixture } from "./helpers.ts";

const fixtures = readdirSync(new URL("../fixtures/", import.meta.url))
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(/\.json$/, ""));

const load = (name: string) => toReportData(parseReport(readFixture(name)));

describe.each(fixtures)("fixture %s", (name) => {
  it("parses, transforms and aggregates", () => {
    const data = load(name);
    expect(data.repositories.length).toBeGreaterThan(0);
    expect(summarize(data).deps).toBeGreaterThan(0);
    expect(packageIndex(data.repositories).length).toBeGreaterThan(0);
  });
});

describe("platform fixtures", () => {
  it("has one for each supported platform", () => {
    expect(fixtures).toEqual(expect.arrayContaining(["github-report", "gitlab-report-full", "local-report"]));
  });

  it("local: one repository named local, without branches", () => {
    const data = load("local-report");
    expect(data.repositories.map((r) => r.name)).toEqual(["local"]);
    expect(data.repositories[0]?.branches).toEqual([]);
    expect([...allDeps(data.repositories)].length).toBeGreaterThan(0);
  });

  it("gitlab: keeps nested group paths and branch data", () => {
    const data = load("gitlab-report-full");
    const names = data.repositories.map((r) => r.name);
    expect(names).toContain("gitlab-org/cli");
    expect(names).toContain("gitlab-org/frontend/eslint-plugin");
    expect(names).toContain("gitlab-org/ci-cd/runner-tools/base-images");
    expect(data.repositories.every((r) => r.platform === "gitlab")).toBe(true);
    expect(data.repositories.some((r) => r.branches.length > 0)).toBe(true);
  });
});
