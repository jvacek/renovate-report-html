/**
 * Zod schema for the subset of Renovate's `reportType=file` output that we use.
 *
 * The report format is experimental upstream and can change between minor
 * versions, so this schema is deliberately narrow: it only describes fields the
 * viewer needs and strips everything else. Fields we do use are type checked, so
 * a changed shape fails loudly instead of rendering a misleading page. Fields
 * are optional unless the page cannot be built without them.
 */
import { z } from "zod";

const optionalString = z.string().optional();
const optionalNumber = z.number().optional();
const optionalBoolean = z.boolean().optional();

/** Bunyan-style log record. Extra keys are kept and shown as context. */
export const problemSchema = z.looseObject({
  level: z.number().optional(),
  msg: z.string(),
});

const warningSchema = z.union([z.string(), z.looseObject({ topic: z.string().optional(), message: z.string() })]);

export const updateSchema = z.object({
  updateType: optionalString,
  newVersion: optionalString,
  newValue: optionalString,
  newDigest: z.string().nullish(),
  newMajor: optionalNumber,
  releaseTimestamp: optionalString,
  newVersionAgeInDays: optionalNumber,
  isBreaking: optionalBoolean,
  branchName: optionalString,
  libYears: optionalNumber,
});

export const depSchema = z.object({
  depName: optionalString,
  packageName: optionalString,
  datasource: optionalString,
  depType: optionalString,
  currentValue: optionalString,
  currentVersion: optionalString,
  currentDigest: optionalString,
  lockedVersion: optionalString,
  currentVersionTimestamp: optionalString,
  currentVersionAgeInDays: optionalNumber,
  skipReason: optionalString,
  registryUrl: optionalString,
  sourceUrl: optionalString,
  homepage: optionalString,
  changelogUrl: optionalString,
  /** The text Renovate matched in the file. Only used to name deps without a depName. */
  replaceString: optionalString,
  updates: z.array(updateSchema).default([]),
  warnings: z.array(warningSchema).default([]),
});

export const packageFileSchema = z.object({
  packageFile: z.string(),
  lockFiles: z.array(z.string()).optional(),
  deps: z.array(depSchema).default([]),
});

export const branchUpgradeSchema = z.object({
  depName: optionalString,
  packageName: optionalString,
  datasource: optionalString,
  manager: optionalString,
  packageFile: optionalString,
  currentVersion: optionalString,
  currentValue: optionalString,
  newVersion: optionalString,
  newValue: optionalString,
  updateType: optionalString,
  isVulnerabilityAlert: optionalBoolean,
});

export const branchSchema = z.object({
  branchName: z.string(),
  prNo: z.number().nullish(),
  prTitle: optionalString,
  result: optionalString,
  baseBranch: optionalString,
  automerge: optionalBoolean,
  isConflicted: optionalBoolean,
  isModified: optionalBoolean,
  upgrades: z.array(branchUpgradeSchema).default([]),
});

export const repositorySchema = z.object({
  problems: z.array(problemSchema).default([]),
  branches: z.array(branchSchema).default([]),
  packageFiles: z.record(z.string(), z.array(packageFileSchema)).default({}),
  libYearsWithStatus: z
    .object({
      libYears: z.object({ total: z.number() }).optional(),
      dependencyStatus: z.object({ outdated: z.number(), total: z.number() }).optional(),
    })
    .optional(),
  platform: optionalString,
  defaultBranch: optionalString,
  status: optionalString,
  configFileName: optionalString,
});

export const reportSchema = z.object({
  problems: z.array(problemSchema).default([]),
  repositories: z.record(z.string(), repositorySchema),
});

export type RawReport = z.infer<typeof reportSchema>;
export type RawRepository = z.infer<typeof repositorySchema>;
export type RawDep = z.infer<typeof depSchema>;
export type RawProblem = z.infer<typeof problemSchema>;

export class ReportFormatError extends Error {
  override name = "ReportFormatError";
}

/** Validate an already parsed JSON value. Throws ReportFormatError with a readable message. */
export function parseReport(input: unknown): RawReport {
  const result = reportSchema.safeParse(input);
  if (!result.success) {
    throw new ReportFormatError(
      `This does not look like a Renovate report (reportType=file), or its format changed:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
