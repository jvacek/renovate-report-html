/** Links to a package's page on its public registry, derived from the Renovate datasource. */
import type { Dep } from "./data.ts";

export interface RegistryLink {
  /** Registry name, as in "View on npm". */
  label: string;
  url: string;
}

type LinkFor = (name: string) => RegistryLink | undefined;

/**
 * Per datasource: the registry hosts we know how to link to (an unset
 * registryUrl means Renovate's default), and how to build the link.
 */
const REGISTRIES: Record<string, { hosts: string[]; link: LinkFor }> = {
  npm: {
    hosts: ["registry.npmjs.org"],
    link: (name) => ({ label: "npm", url: `https://www.npmjs.com/package/${name}` }),
  },
  pypi: {
    hosts: ["pypi.org"],
    link: (name) => ({ label: "PyPI", url: `https://pypi.org/project/${name}/` }),
  },
  go: {
    hosts: ["proxy.golang.org"],
    link: (name) => ({ label: "pkg.go.dev", url: `https://pkg.go.dev/${name}` }),
  },
  "github-tags": { hosts: ["github.com", "api.github.com"], link: github },
  "github-releases": { hosts: ["github.com", "api.github.com"], link: github },
  "github-digest": { hosts: ["github.com", "api.github.com"], link: github },
  "github-runners": {
    hosts: [],
    link: () => ({ label: "GitHub", url: "https://github.com/actions/runner-images" }),
  },
  // The image name carries the registry host, and registryUrl follows it, so docker() decides.
  docker: { hosts: [], link: docker },
  crate: {
    hosts: ["crates.io", "index.crates.io"],
    link: (name) => ({ label: "crates.io", url: `https://crates.io/crates/${name}` }),
  },
  rubygems: {
    hosts: ["rubygems.org"],
    link: (name) => ({ label: "RubyGems", url: `https://rubygems.org/gems/${name}` }),
  },
  nuget: {
    hosts: ["api.nuget.org", "www.nuget.org"],
    link: (name) => ({ label: "NuGet", url: `https://www.nuget.org/packages/${name}` }),
  },
  packagist: {
    hosts: ["repo.packagist.org", "packagist.org"],
    link: (name) => ({ label: "Packagist", url: `https://packagist.org/packages/${name}` }),
  },
  hex: {
    hosts: ["hex.pm"],
    link: (name) => ({ label: "Hex", url: `https://hex.pm/packages/${name}` }),
  },
  dart: {
    hosts: ["pub.dartlang.org", "pub.dev"],
    link: (name) => ({ label: "pub.dev", url: `https://pub.dev/packages/${name}` }),
  },
  maven: { hosts: ["repo1.maven.org", "repo.maven.apache.org"], link: maven },
  "terraform-provider": {
    hosts: ["registry.terraform.io"],
    link: (name) => ({ label: "Terraform Registry", url: `https://registry.terraform.io/providers/${name}` }),
  },
  "terraform-module": {
    hosts: ["registry.terraform.io"],
    link: (name) => ({ label: "Terraform Registry", url: `https://registry.terraform.io/modules/${name}` }),
  },
  "golang-version": {
    hosts: [],
    link: () => ({ label: "go.dev", url: "https://go.dev/doc/devel/release" }),
  },
  "node-version": {
    hosts: [],
    link: () => ({ label: "nodejs.org", url: "https://nodejs.org/en/about/previous-releases" }),
  },
  "python-version": {
    hosts: [],
    link: () => ({ label: "python.org", url: "https://www.python.org/downloads/" }),
  },
};

function github(name: string): RegistryLink | undefined {
  return /^[\w.-]+\/[\w.-]+$/.test(name) ? { label: "GitHub", url: `https://github.com/${name}` } : undefined;
}

/** Docker Hub, plus a few public registries that have browsable pages. */
function docker(name: string): RegistryLink | undefined {
  const [first = "", ...rest] = name.split("/");
  const path = rest.join("/");
  if (first === "docker.io" || first === "index.docker.io") return docker(path);
  // ghcr.io image URLs redirect to the package page on GitHub when opened in a browser.
  if (first === "ghcr.io") return { label: "GitHub Packages", url: `https://ghcr.io/${path}` };
  if (first === "quay.io") return { label: "Quay", url: `https://quay.io/repository/${path}` };
  if (first === "mcr.microsoft.com")
    return { label: "Microsoft Artifact Registry", url: `https://mcr.microsoft.com/artifact/mar/${path}` };
  // Anything else with a host (contains a dot, colon or is localhost) is a registry we can't link to.
  if (rest.length > 0 && (first.includes(".") || first.includes(":") || first === "localhost")) return undefined;
  const hubPath = rest.length === 0 || first === "library" ? `_/${rest.length ? path : first}` : `r/${name}`;
  return { label: "Docker Hub", url: `https://hub.docker.com/${hubPath}` };
}

function maven(name: string): RegistryLink | undefined {
  const [group, artifact] = name.split(":");
  if (!group || !artifact) return undefined;
  return { label: "Maven Central", url: `https://central.sonatype.com/artifact/${group}/${artifact}` };
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

export function registryLink(
  dep: Pick<Dep, "datasource" | "packageName" | "name" | "registryUrl">,
): RegistryLink | undefined {
  const registry = dep.datasource ? REGISTRIES[dep.datasource] : undefined;
  if (!registry) return undefined;
  // A private or mirrored registry: we don't know its web UI.
  if (dep.registryUrl && registry.hosts.length > 0) {
    const host = hostOf(dep.registryUrl);
    if (!host || !registry.hosts.includes(host)) return undefined;
  }
  return registry.link(dep.packageName ?? dep.name);
}
