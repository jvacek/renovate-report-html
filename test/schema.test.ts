import { describe, expect, it } from "vitest";
import { parseReport, ReportFormatError } from "../src/report/schema.ts";
import { fullReport, lookupReport } from "./helpers.ts";

describe("parseReport", () => {
  it.each([
    ["lookup", lookupReport],
    ["full", fullReport],
  ])("accepts the %s fixture", (_, load) => {
    const report = parseReport(load());
    expect(Object.keys(report.repositories)).toHaveLength(5);
  });

  it("strips fields the viewer does not use", () => {
    const report = parseReport(lookupReport());
    const deps = Object.values(report.repositories).flatMap((repo) =>
      Object.values(repo.packageFiles).flatMap((files) => files.flatMap((file) => file.deps)),
    );
    expect(deps.length).toBeGreaterThan(0);
    for (const dep of deps) {
      expect(dep).not.toHaveProperty("autoReplaceStringTemplate");
      expect(dep).not.toHaveProperty("managerData");
      expect(dep).not.toHaveProperty("replaceString");
    }
  });

  it("keeps unknown problem fields as context", () => {
    const report = parseReport(lookupReport());
    const problem = report.repositories["docker-library/hello-world"]?.problems.find((p) => "hiddenCharacters" in p);
    expect(problem).toMatchObject({
      file: "Dockerfile.build",
      hiddenCharacters: "\\u00A0",
    });
  });

  it("fills in missing optional collections", () => {
    const report = parseReport({ repositories: { "a/b": {} } });
    expect(report.problems).toEqual([]);
    expect(report.repositories["a/b"]).toMatchObject({
      problems: [],
      branches: [],
      packageFiles: {},
    });
  });

  it("ignores unknown top-level and repository fields", () => {
    const report = parseReport({
      futureField: 1,
      repositories: { "a/b": { somethingNew: { x: 1 } } },
    });
    expect(report).not.toHaveProperty("futureField");
    expect(report.repositories["a/b"]).not.toHaveProperty("somethingNew");
  });

  it("rejects input that is not a report", () => {
    expect(() => parseReport([])).toThrow(ReportFormatError);
    expect(() => parseReport({ problems: [] })).toThrow(/repositories/);
  });

  it("points at the offending field when a used field changes type", () => {
    const bad = {
      repositories: {
        "a/b": {
          packageFiles: {
            npm: [
              {
                packageFile: "package.json",
                deps: [{ currentVersionAgeInDays: "old" }],
              },
            ],
          },
        },
      },
    };
    expect(() => parseReport(bad)).toThrow(
      'at repositories["a/b"].packageFiles.npm[0].deps[0].currentVersionAgeInDays',
    );
  });
});
