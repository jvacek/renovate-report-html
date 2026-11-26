/** Links to a repository on its code host, derived from the Renovate platform and repository path. */

export interface PlatformLinks {
  repo: string;
  /** "Pull requests" or "Merge requests", as the platform calls them. */
  changesLabel: string;
  changes: string;
  change: (number: number) => string;
}

/** What the platform calls a change request: GitLab has merge requests, the rest pull requests. */
export function changeTerms(platform?: string): { short: string; long: string } {
  return platform === "gitlab" ? { short: "MR", long: "merge request" } : { short: "PR", long: "pull request" };
}

const DEFAULT_URLS: Record<string, string> = {
  github: "https://github.com",
  gitlab: "https://gitlab.com",
};

/**
 * Turn a Renovate `endpoint` (an API URL such as `https://gitlab.example.com/api/v4/`)
 * or a plain web URL into the web base URL. Throws on anything that is not http(s).
 */
export function platformWebUrl(endpoint: string): string {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Platform URL must be http or https: ${endpoint}`);
  }
  if (url.hostname === "api.github.com") url.hostname = "github.com";
  const path = url.pathname.replace(/\/+$/, "").replace(/\/api(\/v\d+)?$/, "");
  return `${url.origin}${path}`;
}

/** Undefined for platforms we can't link to, such as local runs. */
export function platformLinks(repo: { name: string; platform?: string }, baseUrl?: string): PlatformLinks | undefined {
  const base = baseUrl ?? (repo.platform && DEFAULT_URLS[repo.platform]);
  if (!base) return undefined;
  const repoUrl = `${base}/${repo.name}`;
  switch (repo.platform) {
    case "github":
      return {
        repo: repoUrl,
        changesLabel: "Pull requests",
        changes: `${repoUrl}/pulls`,
        change: (n) => `${repoUrl}/pull/${n}`,
      };
    case "gitlab":
      return {
        repo: repoUrl,
        changesLabel: "Merge requests",
        changes: `${repoUrl}/-/merge_requests`,
        change: (n) => `${repoUrl}/-/merge_requests/${n}`,
      };
    default:
      return undefined;
  }
}
