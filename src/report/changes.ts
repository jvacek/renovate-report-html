/** Open Renovate pull or merge requests, from the branch data of a full (non-lookup) run. */
import type { Branch, Repository } from "./data.ts";
import { type DepRef, packageId } from "./stats.ts";

export interface OpenChange {
  repo: Repository;
  branch: Branch & { prNo: number };
}

/**
 * Renovate sets prNo to the branch's open PR. The one exception is a branch it
 * skipped because a matching PR was closed before: then prNo is that closed PR
 * and the result is "already-existed".
 */
export function isOpenChange(branch: Branch): branch is Branch & { prNo: number } {
  return typeof branch.prNo === "number" && branch.result !== "already-existed";
}

export function openChanges(repo: Repository): OpenChange[] {
  return repo.branches.filter(isOpenChange).map((branch) => ({ repo, branch }));
}

/** Whether any repository has an open change. Lookup runs and local runs have no branch data, so never do. */
export function hasOpenChanges(repos: Repository[]): boolean {
  return repos.some((repo) => repo.branches.some(isOpenChange));
}

function useKey(repo: string, packageFile: string | undefined, id: string): string {
  return JSON.stringify([repo, packageFile, id]);
}

/** Open changes per dependency use (repository, package file and package). */
export function openChangesByUse(repos: Repository[]): (ref: DepRef) => OpenChange[] {
  const index = new Map<string, OpenChange[]>();
  for (const repo of repos) {
    for (const change of openChanges(repo)) {
      const keys = new Set(
        change.branch.upgrades.map((u) => useKey(repo.name, u.packageFile, packageId({ ...u, name: u.depName ?? "" }))),
      );
      for (const key of keys) {
        const list = index.get(key) ?? [];
        list.push(change);
        index.set(key, list);
      }
    }
  }
  return (ref) =>
    index.get(
      useKey(ref.repo, ref.packageFile, `${ref.dep.datasource ?? "unknown"}:${ref.dep.packageName ?? ref.dep.name}`),
    ) ?? [];
}
