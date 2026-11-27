import { describe, expect, it } from "vitest";
import { href, parseHash } from "../src/viewer/router.ts";

describe("router", () => {
  it.each([
    ["", { name: "overview" }],
    ["#/", { name: "overview" }],
    ["#/repos", { name: "repos" }],
    ["#/repo/a%2Fb", { name: "repo", repo: "a/b" }],
    ["#/repo/", { name: "repos" }],
    ["#/packages", { name: "packages", query: "", datasources: [] }],
    ["#/package/npm%3A%40types%2Fnode", { name: "package", id: "npm:@types/node" }],
    ["#/changes", { name: "changes" }],
    ["#/nope", { name: "notFound", path: "nope" }],
  ])("parses %s", (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
  });

  it("round-trips the package filter", () => {
    const filter = { query: "actions/check", datasources: ["github-tags", "npm"] };
    const link = href.packages(filter);
    expect(link).toBe("#/packages?q=actions%2Fcheck&ds=github-tags,npm");
    expect(parseHash(link)).toEqual({ name: "packages", ...filter });
  });

  it("round-trips GitLab nested group paths", () => {
    expect(parseHash(href.repo("group/sub/project"))).toEqual({ name: "repo", repo: "group/sub/project" });
  });

  it("links to the plain packages page without a filter", () => {
    expect(href.packages()).toBe("#/packages");
  });
});
