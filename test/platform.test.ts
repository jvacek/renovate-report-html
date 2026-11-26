import { describe, expect, it } from "vitest";
import { toReportData } from "../src/report/data.ts";
import { platformLinks, platformWebUrl } from "../src/report/platform.ts";
import { parseReport } from "../src/report/schema.ts";
import { readFixture } from "./helpers.ts";

describe("platformLinks", () => {
  it("links GitHub repositories and pull requests on github.com", () => {
    const links = platformLinks({ name: "expressjs/express", platform: "github" });
    expect(links?.repo).toBe("https://github.com/expressjs/express");
    expect(links?.changesLabel).toBe("Pull requests");
    expect(links?.changes).toBe("https://github.com/expressjs/express/pulls");
    expect(links?.change(12)).toBe("https://github.com/expressjs/express/pull/12");
  });

  it("links GitLab projects with nested groups and merge requests on gitlab.com", () => {
    const links = platformLinks({ name: "gitlab-org/frontend/eslint-plugin", platform: "gitlab" });
    expect(links?.repo).toBe("https://gitlab.com/gitlab-org/frontend/eslint-plugin");
    expect(links?.changesLabel).toBe("Merge requests");
    expect(links?.changes).toBe("https://gitlab.com/gitlab-org/frontend/eslint-plugin/-/merge_requests");
    expect(links?.change(7)).toBe("https://gitlab.com/gitlab-org/frontend/eslint-plugin/-/merge_requests/7");
  });

  it("uses a self-hosted base URL", () => {
    expect(platformLinks({ name: "team/app", platform: "gitlab" }, "https://git.example.com")?.repo).toBe(
      "https://git.example.com/team/app",
    );
  });

  it("has no links for local runs or unknown platforms", () => {
    expect(platformLinks({ name: "local", platform: "local" })).toBeUndefined();
    expect(platformLinks({ name: "a/b", platform: "bitbucket" }, "https://bb.example.com")).toBeUndefined();
    expect(platformLinks({ name: "a/b" })).toBeUndefined();
  });
});

describe("platformWebUrl", () => {
  it.each([
    ["https://gitlab.example.com/api/v4/", "https://gitlab.example.com"],
    ["https://example.com/gitlab/api/v4", "https://example.com/gitlab"],
    ["https://ghe.example.com/api/v3/", "https://ghe.example.com"],
    ["https://api.github.com/", "https://github.com"],
    ["https://gitlab.example.com/", "https://gitlab.example.com"],
  ])("%s -> %s", (endpoint, expected) => {
    expect(platformWebUrl(endpoint)).toBe(expected);
  });

  it("rejects non-http URLs", () => {
    expect(() => platformWebUrl("ftp://example.com")).toThrow();
    expect(() => platformWebUrl("not a url")).toThrow();
  });

  it("is normalised into the report data", () => {
    const data = toReportData(parseReport(readFixture("gitlab-report-full")), {
      platformUrl: "https://git.example.com/api/v4/",
    });
    expect(data.platformUrl).toBe("https://git.example.com");
  });
});

describe("repository platform", () => {
  it("fills in the run's platform for repositories that lack it", () => {
    const raw = readFixture("gitlab-report-full") as { repositories: Record<string, { platform?: string }> };
    const [first] = Object.values(raw.repositories);
    if (first) delete first.platform;
    const data = toReportData(parseReport(raw));
    expect(data.repositories.every((r) => r.platform === "gitlab")).toBe(true);
  });
});
