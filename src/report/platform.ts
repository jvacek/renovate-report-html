/** Links to a repository on its code host, derived from the Renovate platform and repository path. */

export interface PlatformLinks {
  repo: string;
  /** The project's own icon. Only GitLab has one per repository; it answers 404 when none is set. */
  avatar?: string;
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

type IconRepo = { name: string; platform?: string; icon?: string };
type IconReport = { platformUrl?: string; embeddedIcons?: boolean };

/**
 * Where the viewer gets a repository's icon: the file the CLI embedded (`--icons`), or else a
 * hotlink to GitLab, which only loads for public projects. Once icons are embedded, a missing
 * one means there is none, so nothing is hotlinked.
 */
export function repoIcon(repo: IconRepo, report: IconReport): string | undefined {
  return report.embeddedIcons ? repo.icon : platformLinks(repo, report.platformUrl)?.avatar;
}

/**
 * A group's icon, the same way as `repoIcon`: embedded, or else hotlinked from GitLab, which only
 * loads for public groups. Other platforms have none.
 */
export function groupIcon(
  path: string,
  platform: string | undefined,
  report: IconReport & { groupIcons?: Record<string, string> },
): string | undefined {
  if (report.embeddedIcons) return report.groupIcons?.[path];
  if (platform !== "gitlab") return undefined;
  return `${report.platformUrl ?? DEFAULT_URLS.gitlab}/api/v4/groups/${encodeURIComponent(path)}/avatar`;
}

/** Whether repositories get an icon slot (with a letter tile when there is no icon), so names line up. */
export function hasIconSlot(repo: IconRepo, report: IconReport): boolean {
  return Boolean(report.embeddedIcons || platformLinks(repo, report.platformUrl)?.avatar);
}

/** "group/sub/app" -> { path: "group/sub/", name: "app" }. The path is empty for names without a slash. */
export function splitRepoName(full: string): { path: string; name: string } {
  const cut = full.lastIndexOf("/") + 1;
  return { path: full.slice(0, cut), name: full.slice(cut) };
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
        avatar: `${base}/api/v4/projects/${encodeURIComponent(repo.name)}/avatar`,
        changesLabel: "Merge requests",
        changes: `${repoUrl}/-/merge_requests`,
        change: (n) => `${repoUrl}/-/merge_requests/${n}`,
      };
    default:
      return undefined;
  }
}
