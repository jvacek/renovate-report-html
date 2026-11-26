import { describe, expect, it } from "vitest";
import type { ReportData, Repository } from "../src/report/data.ts";
import { embedIcons, imageType, LARGE_ICON_BYTES, matchIconFiles } from "../src/report/icons.ts";
import { groupIcon, hasIconSlot, repoIcon } from "../src/report/platform.ts";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const repo = (name: string, platform = "gitlab"): Repository => ({
  name,
  platform,
  problems: [],
  branches: [],
  managers: [],
});

const report = (repositories: Repository[]): ReportData => ({
  version: 1,
  title: "t",
  generatedAt: "2026-01-01T00:00:00.000Z",
  problems: [],
  repositories,
});

/** A reader over an in-memory directory. */
const reader = (files: Record<string, Uint8Array>) => async (file: string) => {
  const bytes = files[file];
  if (!bytes) throw new Error(`read unexpected file ${file}`);
  return bytes;
};

describe("imageType", () => {
  it.each([
    [[0x89, 0x50, 0x4e, 0x47], "image/png"],
    [[0xff, 0xd8, 0xff, 0xe0], "image/jpeg"],
    [[0x47, 0x49, 0x46, 0x38], "image/gif"],
    [[0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], "image/webp"],
    [[0x00, 0x00, 0x01, 0x00], "image/x-icon"],
    [[0x3c, 0x73, 0x76, 0x67], undefined],
  ])("%j -> %s", (bytes, type) => {
    expect(imageType(new Uint8Array(bytes))).toBe(type);
  });
});

describe("matchIconFiles", () => {
  it("matches nested repository paths whatever the extension", () => {
    const matches = matchIconFiles(
      ["group/sub/app.webp", "group/other.png", "group/sub.jpg", "unrelated/x.png"],
      ["group/sub/app", "group/other", "group/missing"],
    );
    expect(Object.fromEntries(matches)).toEqual({
      "group/sub/app": "group/sub/app.webp",
      "group/other": "group/other.png",
    });
  });

  it("picks one file when a repository has several", () => {
    expect(matchIconFiles(["g/app.webp", "g/app.png"], ["g/app"]).get("g/app")).toBe("g/app.png");
  });

  it("matches files without an extension", () => {
    expect(matchIconFiles(["g/app"], ["g/app"]).get("g/app")).toBe("g/app");
  });
});

describe("embedIcons", () => {
  it("embeds matching files as data URLs", async () => {
    const result = await embedIcons(
      report([repo("group/app"), repo("group/none")]),
      ["group/app.png"],
      reader({ "group/app.png": PNG }),
    );
    expect(result.embedded).toBe(1);
    expect(result.warnings).toEqual([]);
    expect(result.data.embeddedIcons).toBe(true);
    expect(result.data.repositories[0]?.icon).toBe(`data:image/png;base64,${Buffer.from(PNG).toString("base64")}`);
    expect(result.data.repositories[1]?.icon).toBeUndefined();
  });

  it("skips files that aren't images and warns about large ones", async () => {
    const big = new Uint8Array(LARGE_ICON_BYTES + 1);
    big.set(PNG);
    const result = await embedIcons(
      report([repo("g/big"), repo("g/text")]),
      ["g/big.png", "g/text.png"],
      reader({ "g/big.png": big, "g/text.png": new TextEncoder().encode("not an image") }),
    );
    expect(result.embedded).toBe(1);
    expect(result.data.repositories.map((r) => Boolean(r.icon))).toEqual([true, false]);
    expect(result.warnings).toEqual([expect.stringContaining("g/big.png"), expect.stringContaining("g/text.png")]);
  });

  it("embeds group icons from the group's path", async () => {
    const result = await embedIcons(
      report([repo("group/sub/app")]),
      ["group.png", "group/sub.png", "other.png"],
      reader({ "group.png": PNG, "group/sub.png": PNG }),
    );
    expect(result.embedded).toBe(0);
    expect(result.embeddedGroups).toBe(2);
    expect(Object.keys(result.data.groupIcons ?? {})).toEqual(["group", "group/sub"]);
  });
});

describe("groupIcon", () => {
  it("hotlinks GitLab groups until the CLI embedded icons", () => {
    expect(groupIcon("group/sub", "gitlab", {})).toBe(
      `https://gitlab.com/api/v4/groups/${encodeURIComponent("group/sub")}/avatar`,
    );
    expect(groupIcon("group", "gitlab", { platformUrl: "https://git.example.com" })).toBe(
      "https://git.example.com/api/v4/groups/group/avatar",
    );
    expect(groupIcon("group", "gitlab", { embeddedIcons: true, groupIcons: { group: "data:x" } })).toBe("data:x");
    expect(groupIcon("other", "gitlab", { embeddedIcons: true })).toBeUndefined();
    expect(groupIcon("org", "github", {})).toBeUndefined();
  });
});

describe("repoIcon and hasIconSlot", () => {
  const avatar = `https://gitlab.com/api/v4/projects/${encodeURIComponent("group/app")}/avatar`;

  it("hotlinks GitLab icons until the CLI embedded some", () => {
    expect(repoIcon(repo("group/app"), {})).toBe(avatar);
    expect(hasIconSlot(repo("group/app"), {})).toBe(true);
    const app = { ...repo("group/app"), icon: "data:image/png;base64,AA==" };
    expect(repoIcon(app, { embeddedIcons: true })).toBe(app.icon);
    expect(repoIcon(repo("group/none"), { embeddedIcons: true })).toBeUndefined();
  });

  it("gives other platforms a slot only when icons were embedded", () => {
    expect(hasIconSlot(repo("org/repo", "github"), {})).toBe(false);
    expect(hasIconSlot(repo("org/repo", "github"), { embeddedIcons: true })).toBe(true);
  });
});
