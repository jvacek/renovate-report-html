/**
 * Renovate pull or merge requests, from the branch data of a full (non-lookup) run: the open
 * ones, and the ones a limit held back from opening.
 */
import type { Branch, Repository } from "./data.ts";
import { type DepRef, packageId } from "./stats.ts";

export interface OpenChange {
  repo: Repository;
  branch: Branch & { prNo: number };
}

/** The Renovate limit that held a change back: concurrent branches, PRs (concurrent or hourly), or commits. */
export type Limit = "branch" | "pr" | "commit-hourly" | "commit-per-run";

/** A change Renovate wants to make but has not opened a PR for, because it hit a limit. */
export interface HeldBackChange {
  repo: Repository;
  branch: Branch;
  limit: Limit;
}

const LIMIT_RESULTS: Record<string, Limit> = {
  "branch-limit-reached": "branch",
  "pr-limit-reached": "pr",
  "commit-hourly-limit-reached": "commit-hourly",
  "commit-per-run-limit-reached": "commit-per-run",
};

/**
 * How to name a limit, with `term` for what the platform calls a PR ("PR" or "MR"), and a
 * tooltip naming the Renovate settings behind it.
 */
export function describeLimit(limit: Limit, term: string): { label: string; title: string } {
  switch (limit) {
    case "branch":
      return {
        label: "branch limit",
        title: "Renovate has as many branches open as branchConcurrentLimit allows (it defaults to prConcurrentLimit).",
      };
    case "pr":
      return {
        label: `${term} limit`,
        title: `Renovate has opened as many ${term}s as prConcurrentLimit or prHourlyLimit allows.`,
      };
    case "commit-hourly":
      return {
        label: "hourly commit limit",
        title: "Renovate made as many commits this hour as commitHourlyLimit allows.",
      };
    case "commit-per-run":
      return { label: "commits per run limit", title: "Renovate made as many commits as it may in one run." };
  }
}

/**
 * Renovate sets prNo to the branch's open PR. The one exception is a branch it
 * skipped because a matching PR was closed before: then prNo is that closed PR
 * and the result is "already-existed".
 */
export function isOpenChange(branch: Branch): branch is Branch & { prNo: number } {
  return typeof branch.prNo === "number" && branch.result !== "already-existed";
}

/**
 * The limit that kept Renovate from opening a PR for this branch. Commit limits can also hit a
 * branch whose PR is already open; that one is open, not held back.
 */
export function heldBackBy(branch: Branch): Limit | undefined {
  return typeof branch.prNo === "number" ? undefined : LIMIT_RESULTS[branch.result ?? ""];
}

export function openChanges(repo: Repository): OpenChange[] {
  return repo.branches.filter(isOpenChange).map((branch) => ({ repo, branch }));
}

export function heldBackChanges(repo: Repository): HeldBackChange[] {
  return repo.branches.flatMap((branch) => {
    const limit = heldBackBy(branch);
    return limit ? [{ repo, branch, limit }] : [];
  });
}

/** How many of a branch's upgrades are of each update type. */
export function upgradesByType(branch: Branch): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const upgrade of branch.upgrades) {
    const type = upgrade.updateType ?? "unknown";
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

/** Open changes across all repositories, in repository order. */
export function allOpenChanges(repos: Repository[]): OpenChange[] {
  return repos.flatMap(openChanges);
}

/** Held back changes across all repositories, in repository order. */
export function allHeldBackChanges(repos: Repository[]): HeldBackChange[] {
  return repos.flatMap(heldBackChanges);
}

/** Whether any repository has an open change. Lookup runs and local runs have no branch data, so never do. */
export function hasOpenChanges(repos: Repository[]): boolean {
  return repos.some((repo) => repo.branches.some(isOpenChange));
}

function useKey(repo: string, packageFile: string | undefined, id: string): string {
  return JSON.stringify([repo, packageFile, id]);
}

/** Index changes by each dependency use (repository, package file and package) they update. */
function byUse<T extends { repo: Repository; branch: Branch }>(changes: T[]): (ref: DepRef) => T[] {
  const index = new Map<string, T[]>();
  for (const change of changes) {
    const keys = new Set(
      change.branch.upgrades.map((u) =>
        useKey(change.repo.name, u.packageFile, packageId({ ...u, name: u.depName ?? "" })),
      ),
    );
    for (const key of keys) {
      const list = index.get(key) ?? [];
      list.push(change);
      index.set(key, list);
    }
  }
  return (ref) =>
    index.get(
      useKey(ref.repo, ref.packageFile, `${ref.dep.datasource ?? "unknown"}:${ref.dep.packageName ?? ref.dep.name}`),
    ) ?? [];
}

/** Open changes per dependency use. */
export function openChangesByUse(repos: Repository[]): (ref: DepRef) => OpenChange[] {
  return byUse(allOpenChanges(repos));
}

/** Held back changes per dependency use. */
export function heldBackByUse(repos: Repository[]): (ref: DepRef) => HeldBackChange[] {
  return byUse(allHeldBackChanges(repos));
}

/** Open and held back changes per dependency use. */
export interface ChangesByUse {
  open: (ref: DepRef) => OpenChange[];
  heldBack: (ref: DepRef) => HeldBackChange[];
}

export function changesByUse(repos: Repository[]): ChangesByUse {
  return { open: openChangesByUse(repos), heldBack: heldBackByUse(repos) };
}
