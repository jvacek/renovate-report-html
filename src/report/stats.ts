/** Aggregations over ReportData. Pure functions shared by the viewer and tests. */
import type { Dep, ReportData, Repository, Update } from "./data.ts";

export interface DepRef {
  repo: string;
  manager: string;
  packageFile: string;
  dep: Dep;
}

export function* allDeps(repos: Repository[]): Generator<DepRef> {
  for (const repo of repos) {
    for (const manager of repo.managers) {
      for (const file of manager.packageFiles) {
        for (const dep of file.deps) {
          yield {
            repo: repo.name,
            manager: manager.name,
            packageFile: file.path,
            dep,
          };
        }
      }
    }
  }
}

export function updateTypeOf(update: Update): string {
  return update.updateType ?? "unknown";
}

export interface Summary {
  repositories: number;
  deps: number;
  depsWithUpdates: number;
  updatesByType: Record<string, number>;
  skippedByReason: Record<string, number>;
  problems: number;
}

export function summarize(data: ReportData): Summary {
  const summary: Summary = {
    repositories: data.repositories.length,
    deps: 0,
    depsWithUpdates: 0,
    updatesByType: {},
    skippedByReason: {},
    problems: data.problems.length + data.repositories.reduce((n, r) => n + r.problems.length, 0),
  };
  for (const { dep } of allDeps(data.repositories)) {
    summary.deps++;
    if (dep.updates.length > 0) summary.depsWithUpdates++;
    for (const update of dep.updates) increment(summary.updatesByType, updateTypeOf(update));
    if (dep.skipReason) increment(summary.skippedByReason, dep.skipReason);
  }
  return summary;
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

export interface PackageUsage {
  /** Stable id used in URLs: `datasource:packageName`. */
  id: string;
  name: string;
  datasource?: string;
  usages: DepRef[];
  repos: string[];
  /** Highest version any update proposes, if any. */
  latest?: string;
  maxAgeInDays?: number;
}

export function packageId(dep: Pick<Dep, "datasource" | "packageName" | "name">): string {
  return `${dep.datasource ?? "unknown"}:${dep.packageName ?? dep.name}`;
}

/** Group deps by package across repositories. Sorted by number of repos, then name. */
export function packageIndex(repos: Repository[]): PackageUsage[] {
  const byId = new Map<string, PackageUsage>();
  for (const ref of allDeps(repos)) {
    const id = packageId(ref.dep);
    let entry = byId.get(id);
    if (!entry) {
      entry = {
        id,
        name: ref.dep.packageName ?? ref.dep.name,
        datasource: ref.dep.datasource,
        usages: [],
        repos: [],
      };
      byId.set(id, entry);
    }
    entry.usages.push(ref);
    if (!entry.repos.includes(ref.repo)) entry.repos.push(ref.repo);
    const age = ref.dep.currentVersionAgeInDays;
    if (age !== undefined && (entry.maxAgeInDays === undefined || age > entry.maxAgeInDays)) {
      entry.maxAgeInDays = age;
    }
    for (const update of ref.dep.updates) {
      if (update.newVersion && (!entry.latest || compareVersions(update.newVersion, entry.latest) > 0)) {
        entry.latest = update.newVersion;
      }
    }
  }
  return [...byId.values()].sort((a, b) => b.repos.length - a.repos.length || a.name.localeCompare(b.name));
}

/** Loose numeric-aware comparison. Good enough for picking a display value, not for semver logic. */
export function compareVersions(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export type Staleness = "fresh" | "aging" | "stale" | "ancient" | "unknown";

/** Bucket a version age. Thresholds: under 3 months, under 1 year, under 2 years, older. */
export function staleness(ageInDays: number | undefined): Staleness {
  if (ageInDays === undefined) return "unknown";
  if (ageInDays < 90) return "fresh";
  if (ageInDays < 365) return "aging";
  if (ageInDays < 730) return "stale";
  return "ancient";
}

export interface VersionCount {
  version: string;
  /** Number of places (dependency entries) on this version. */
  uses: number;
  repos: string[];
  ageInDays?: number;
}

/** The version a use is on, as shown and grouped in the package views. */
export function versionInUse(dep: Dep): string | undefined {
  return dep.currentVersion ?? dep.currentValue ?? dep.lockedVersion;
}

/** The newest version any use of the package is on. Undefined when all uses agree. */
export function newestInUse(usage: PackageUsage): string | undefined {
  const versions = [...new Set(usage.usages.map(({ dep }) => versionInUse(dep)).filter((v) => v !== undefined))];
  if (versions.length < 2) return undefined;
  return versions.reduce((a, b) => (compareVersions(b, a) > 0 ? b : a));
}

/** Whether a use is on an older version than the newest one in use elsewhere. */
export function isBehind(dep: Dep, newest: string | undefined): boolean {
  const version = versionInUse(dep);
  return newest !== undefined && version !== undefined && compareVersions(version, newest) < 0;
}

/** The versions a package is used at, most used first. */
export function versionCounts(usage: PackageUsage): VersionCount[] {
  const byVersion = new Map<string, VersionCount>();
  for (const { repo, dep } of usage.usages) {
    const version = versionInUse(dep);
    if (version === undefined) continue;
    let entry = byVersion.get(version);
    if (!entry) {
      entry = { version, uses: 0, repos: [], ageInDays: dep.currentVersionAgeInDays };
      byVersion.set(version, entry);
    }
    entry.uses++;
    if (!entry.repos.includes(repo)) entry.repos.push(repo);
  }
  return [...byVersion.values()].sort((a, b) => b.uses - a.uses || compareVersions(b.version, a.version));
}
