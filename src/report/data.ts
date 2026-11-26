/**
 * The trimmed data model embedded into the HTML page. The CLI produces it from
 * a validated report; the viewer only ever reads it.
 */
import type { z } from "zod";
import { platformWebUrl } from "./platform.ts";
import type { branchSchema, RawDep, RawProblem, RawReport, RawRepository, updateSchema } from "./schema.ts";

export const DATA_VERSION = 1;

export interface ReportData {
  version: typeof DATA_VERSION;
  title: string;
  generatedAt: string;
  /** Web URL of a self-hosted GitHub or GitLab. Unset means github.com or gitlab.com. */
  platformUrl?: string;
  /** Set when the CLI embedded icons (`--icons`); the viewer then only shows `Repository.icon` and doesn't hotlink. */
  embeddedIcons?: boolean;
  /** Group icons as data URLs by group path, when the CLI embedded icons. */
  groupIcons?: Record<string, string>;
  problems: Problem[];
  repositories: Repository[];
}

export interface Problem {
  /** Bunyan level: 30 info, 40 warn, 50 error, 60 fatal. */
  level?: number;
  message: string;
  /** Extra fields from the log record, such as a documentation URL or file name. */
  context: Record<string, string>;
}

export interface Repository {
  name: string;
  problems: Problem[];
  branches: Branch[];
  managers: Manager[];
  libYears?: number;
  dependencyStatus?: { outdated: number; total: number };
  platform?: string;
  defaultBranch?: string;
  status?: string;
  configFileName?: string;
  /** Project icon as a data URL, when the CLI embedded icons. */
  icon?: string;
}

export interface Manager {
  name: string;
  packageFiles: PackageFile[];
}

export interface PackageFile {
  path: string;
  lockFiles?: string[];
  deps: Dep[];
}

export type Update = z.infer<typeof updateSchema>;
export type Branch = z.infer<typeof branchSchema>;

export interface Dep extends Omit<RawDep, "depName" | "warnings"> {
  name: string;
  warnings: string[];
}

/** Log record fields that are noise in a report page. */
const HIDDEN_PROBLEM_KEYS = new Set(["msg", "level", "name", "logContext", "hostname", "pid", "time", "v"]);
const MAX_CONTEXT_LENGTH = 500;

export function toProblem(raw: RawProblem): Problem {
  const context: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (HIDDEN_PROBLEM_KEYS.has(key) || value === undefined || value === null) continue;
    const text = typeof value === "string" ? value : JSON.stringify(value);
    context[key] = text.length > MAX_CONTEXT_LENGTH ? `${text.slice(0, MAX_CONTEXT_LENGTH)}…` : text;
  }
  return { level: raw.level, message: raw.msg, context };
}

function toDep({ depName, warnings, ...rest }: RawDep): Dep {
  return {
    ...rest,
    name: depName ?? rest.packageName ?? "(unnamed)",
    warnings: warnings.map((w) => (typeof w === "string" ? w : w.message)),
  };
}

function toRepository(name: string, raw: RawRepository): Repository {
  return {
    name,
    problems: raw.problems.map(toProblem),
    branches: raw.branches,
    managers: Object.entries(raw.packageFiles)
      .map(([manager, files]) => ({
        name: manager,
        packageFiles: files.map((file) => ({
          path: file.packageFile,
          lockFiles: file.lockFiles,
          deps: file.deps.map(toDep),
        })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    libYears: raw.libYearsWithStatus?.libYears?.total,
    dependencyStatus: raw.libYearsWithStatus?.dependencyStatus,
    platform: raw.platform,
    defaultBranch: raw.defaultBranch,
    status: raw.status,
    configFileName: raw.configFileName,
  };
}

export interface TransformOptions {
  title?: string;
  generatedAt?: Date;
  /** Renovate's `endpoint` or the web URL of the code host, for self-hosted instances. */
  platformUrl?: string;
}

export function toReportData(report: RawReport, options: TransformOptions = {}): ReportData {
  // One Renovate run talks to one platform, but repositories it skipped early leave it unset.
  const platform = Object.values(report.repositories).find((repo) => repo.platform)?.platform;
  return {
    version: DATA_VERSION,
    title: options.title ?? "Renovate report",
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    platformUrl: options.platformUrl && platformWebUrl(options.platformUrl),
    problems: report.problems.map(toProblem),
    repositories: Object.entries(report.repositories)
      .map(([name, repo]) => toRepository(name, { ...repo, platform: repo.platform ?? platform }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
