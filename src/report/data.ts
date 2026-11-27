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
  /** Extra scalar fields from the log record, such as a documentation URL or file name. */
  context: Record<string, string>;
  /** Extra structured fields, such as `err`, too big to show inline. */
  payloads: Payload[];
}

export interface Payload {
  key: string;
  /** One line to show while collapsed: the error message, or the top-level keys. */
  summary: string;
  /** Pretty-printed JSON. */
  json: string;
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

export interface Dep extends Omit<RawDep, "depName" | "warnings" | "replaceString"> {
  /** `depName`, else `packageName`, else the text Renovate found in the file (see `unnamed`). */
  name: string;
  /** Renovate gave no name, typically because the reference contains a variable. */
  unnamed?: true;
  /** How many identical entries the file has, when more than one (like a CI component included per job). */
  occurrences?: number;
  warnings: string[];
}

/** Log record fields that are noise in a report page. */
const HIDDEN_PROBLEM_KEYS = new Set(["msg", "level", "name", "logContext", "hostname", "pid", "time", "v"]);
const MAX_CONTEXT_LENGTH = 500;
/** Payloads are embedded in the page, so a runaway one is cut off rather than bloating it. */
const MAX_PAYLOAD_LENGTH = 20_000;

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

function payloadSummary(value: object): string {
  if (Array.isArray(value)) return `[${value.length} ${value.length === 1 ? "item" : "items"}]`;
  const { name, message } = value as Record<string, unknown>;
  if (typeof message === "string") return typeof name === "string" ? `${name}: ${message}` : message;
  return `{ ${Object.keys(value).join(", ")} }`;
}

export function toProblem(raw: RawProblem): Problem {
  const context: Record<string, string> = {};
  const payloads: Payload[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (HIDDEN_PROBLEM_KEYS.has(key) || value === undefined || value === null) continue;
    if (typeof value === "object") {
      const json = truncate(JSON.stringify(value, null, 2), MAX_PAYLOAD_LENGTH);
      payloads.push({ key, summary: truncate(payloadSummary(value), MAX_CONTEXT_LENGTH), json });
    } else {
      context[key] = truncate(String(value), MAX_CONTEXT_LENGTH);
    }
  }
  return { level: raw.level, message: raw.msg, context, payloads };
}

export function toDep({ depName, replaceString, warnings, ...rest }: RawDep): Dep {
  const name = depName ?? rest.packageName;
  return {
    ...rest,
    name: name ?? replaceString ?? "(unnamed)",
    ...(name === undefined && { unnamed: true as const }),
    warnings: warnings.map((w) => (typeof w === "string" ? w : w.message)),
  };
}

/**
 * Collapse entries Renovate reports more than once in one file with nothing to tell them apart,
 * such as a CI component included by every job. They always share a branch, so one row is enough.
 */
export function mergeDuplicates(deps: Dep[]): Dep[] {
  const byKey = new Map<string, Dep>();
  for (const dep of deps) {
    const key = JSON.stringify(dep);
    const seen = byKey.get(key);
    if (seen) seen.occurrences = (seen.occurrences ?? 1) + 1;
    else byKey.set(key, { ...dep });
  }
  return [...byKey.values()];
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
          deps: mergeDuplicates(file.deps.map(toDep)),
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
