import { describe, expect, it } from "vitest";
import { buildFolderTree, type Folder, groupPaths, parentPaths } from "../src/report/groups.ts";

/** The tree as nested labels, to compare shapes without the bookkeeping. */
const shape = (folder: Folder<string>): unknown => ({
  ...Object.fromEntries(folder.folders.map((f) => [`${f.label} (${f.path})`, shape(f)])),
  ...(folder.items.length && { items: folder.items }),
});

describe("parentPaths and groupPaths", () => {
  it("lists every enclosing group, outermost first", () => {
    expect(parentPaths("a/b/c")).toEqual(["a", "a/b"]);
    expect(parentPaths("solo")).toEqual([]);
    expect(groupPaths(["a/b/c", "a/d", "e"])).toEqual(["a", "a/b"]);
  });
});

describe("buildFolderTree", () => {
  it("nests repositories under their groups", () => {
    const tree = buildFolderTree(["org/cli", "org/web/app", "org/web/api", "solo"], (name) => name);
    expect(shape(tree)).toEqual({
      "org (org)": {
        "web (org/web)": { items: ["org/web/app", "org/web/api"] },
        items: ["org/cli"],
      },
      items: ["solo"],
    });
  });

  it("merges chains of groups that hold only one subgroup", () => {
    const tree = buildFolderTree(
      ["org/ci-cd/runner-tools/base", "org/ci-cd/runner-tools/releaser", "org/cli"],
      (n) => n,
    );
    expect(shape(tree)).toEqual({
      "org (org)": {
        "ci-cd/runner-tools (org/ci-cd/runner-tools)": {
          items: ["org/ci-cd/runner-tools/base", "org/ci-cd/runner-tools/releaser"],
        },
        items: ["org/cli"],
      },
    });
  });

  it("merges from the top when everything sits in one deep group", () => {
    const tree = buildFolderTree(["a/b/c/x", "a/b/c/y"], (n) => n);
    expect(shape(tree)).toEqual({ "a/b/c (a/b/c)": { items: ["a/b/c/x", "a/b/c/y"] } });
  });
});
