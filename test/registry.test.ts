import { describe, expect, it } from "vitest";
import { registryLink } from "../src/report/registry.ts";
import { allDeps } from "../src/report/stats.ts";
import { lookupData } from "./helpers.ts";

const link = (datasource: string, name: string, registryUrl?: string) =>
  registryLink({ datasource, name, registryUrl })?.url;

describe("registryLink", () => {
  it.each([
    ["npm", "@types/node", "https://www.npmjs.com/package/@types/node"],
    ["pypi", "flask", "https://pypi.org/project/flask/"],
    ["go", "github.com/spf13/cobra", "https://pkg.go.dev/github.com/spf13/cobra"],
    ["github-tags", "actions/checkout", "https://github.com/actions/checkout"],
    ["docker", "node", "https://hub.docker.com/_/node"],
    ["docker", "library/node", "https://hub.docker.com/_/node"],
    ["docker", "docker.io/library/node", "https://hub.docker.com/_/node"],
    ["docker", "grafana/grafana", "https://hub.docker.com/r/grafana/grafana"],
    ["docker", "ghcr.io/renovatebot/renovate", "https://ghcr.io/renovatebot/renovate"],
    ["docker", "mcr.microsoft.com/devcontainers/python", "https://mcr.microsoft.com/artifact/mar/devcontainers/python"],
    ["maven", "org.slf4j:slf4j-api", "https://central.sonatype.com/artifact/org.slf4j/slf4j-api"],
  ])("links %s %s", (datasource, name, expected) => {
    expect(link(datasource, name)).toBe(expected);
  });

  it("prefers packageName over the display name", () => {
    expect(registryLink({ datasource: "npm", name: "alias", packageName: "real-pkg" })?.url).toBe(
      "https://www.npmjs.com/package/real-pkg",
    );
  });

  it("skips private or mirrored registries", () => {
    expect(link("npm", "pkg", "https://npm.example.com")).toBeUndefined();
    expect(link("npm", "pkg", "https://registry.npmjs.org")).toBeDefined();
    expect(link("docker", "registry.example.com/team/app")).toBeUndefined();
  });

  it("returns nothing for unknown datasources", () => {
    expect(link("deb", "curl")).toBeUndefined();
    expect(registryLink({ name: "x" })).toBeUndefined();
  });

  it("links most of the fixture", () => {
    const deps = [...allDeps(lookupData().repositories)].map((ref) => ref.dep);
    const linked = deps.filter((dep) => registryLink(dep));
    expect(linked.length / deps.length).toBeGreaterThan(0.9);
  });
});
