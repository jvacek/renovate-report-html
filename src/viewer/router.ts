import { useEffect, useState } from "preact/hooks";

/** Hash routes, so every view has a link and works when opened from file://. */
export type Route =
  | { name: "overview" }
  | { name: "repos" }
  | { name: "repo"; repo: string }
  | ({ name: "packages" } & PackageFilter)
  | { name: "package"; id: string }
  | { name: "problems" }
  | { name: "notFound"; path: string };

export interface PackageFilter {
  query: string;
  /** Datasources to show; empty means all. */
  datasources: string[];
}

const NO_FILTER: PackageFilter = { query: "", datasources: [] };

export function parseHash(hash: string): Route {
  const [path = "", search = ""] = hash.replace(/^#\/?/, "").split("?");
  const [section, ...rest] = path.split("/");
  const param = decodeURIComponent(rest.join("/"));
  const params = new URLSearchParams(search);
  switch (section) {
    case "":
      return { name: "overview" };
    case "repos":
      return { name: "repos" };
    case "repo":
      return param ? { name: "repo", repo: param } : { name: "repos" };
    case "packages":
      return {
        name: "packages",
        query: params.get("q") ?? "",
        datasources: (params.get("ds") ?? "").split(",").filter(Boolean),
      };
    case "package":
      return param ? { name: "package", id: param } : { name: "packages", ...NO_FILTER };
    case "problems":
      return { name: "problems" };
    default:
      return { name: "notFound", path };
  }
}

export const href = {
  overview: () => "#/",
  repos: () => "#/repos",
  repo: (name: string) => `#/repo/${encodeURIComponent(name)}`,
  packages: ({ query, datasources }: PackageFilter = NO_FILTER) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (datasources.length) params.set("ds", datasources.join(","));
    const search = params.toString().replaceAll("%2C", ",");
    return search ? `#/packages?${search}` : "#/packages";
  },
  package: (id: string) => `#/package/${encodeURIComponent(id)}`,
  problems: () => "#/problems",
};

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => {
      const next = parseHash(location.hash);
      setRoute((prev) => {
        // Typing in the package search updates the hash; don't jump to the top for that.
        if (prev.name !== next.name) window.scrollTo(0, 0);
        return next;
      });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

/** Update the hash without adding a history entry (used for search-as-you-type). */
export function replaceHash(hash: string): void {
  history.replaceState(null, "", hash);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
