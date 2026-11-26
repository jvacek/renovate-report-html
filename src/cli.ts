#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { toReportData } from "./report/data.ts";
import { renderHtml } from "./report/render.ts";
import { parseReport, ReportFormatError } from "./report/schema.ts";

const USAGE = `Usage: renovate-report-html <report.json> [-o <dir>] [--title <title>]

Turn a Renovate JSON report (reportType=file) into a self-contained HTML page.

Options:
  -o, --output <dir>   Output directory (default: current directory). Writes index.html.
  -t, --title <title>  Page title (default: "Renovate report").
  -h, --help           Show this help.`;

/** Resolved next to the bundled CLI: dist/cli.mjs reads dist/viewer/index.html. */
const TEMPLATE_URL = new URL("./viewer/index.html", import.meta.url);

async function readJson(path: string): Promise<unknown> {
  const text = await readFile(path, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ReportFormatError(`${path} is not valid JSON: ${(error as Error).message}`);
  }
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o", default: "." },
      title: { type: "string", short: "t" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  const [input] = positionals;
  if (!input || positionals.length > 1) {
    console.error(USAGE);
    return 2;
  }

  const report = parseReport(await readJson(input));
  const data = toReportData(report, { title: values.title });
  const template = await readFile(TEMPLATE_URL, "utf8");
  const outDir = resolve(values.output);
  const outFile = join(outDir, "index.html");
  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, renderHtml(template, data));
  console.log(`Wrote ${outFile} (${data.repositories.length} repositories)`);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    const known = error instanceof ReportFormatError || (error as NodeJS.ErrnoException).code === "ENOENT";
    console.error(`renovate-report-html: ${known ? (error as Error).message : error}`);
    process.exitCode = 1;
  },
);
