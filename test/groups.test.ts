import { describe, expect, it } from "vitest";
import { groupPaths, parentPaths } from "../src/report/groups.ts";

describe("parentPaths and groupPaths", () => {
  it("lists every enclosing group, outermost first", () => {
    expect(parentPaths("a/b/c")).toEqual(["a", "a/b"]);
    expect(parentPaths("solo")).toEqual([]);
    expect(groupPaths(["a/b/c", "a/d", "e"])).toEqual(["a", "a/b"]);
  });
});
