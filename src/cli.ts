#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { toReportData } from "./report/data.ts";
import { embedIcons } from "./report/icons.ts";
import { platformWebUrl } from "./report/platform.ts";
import { renderHtml } from "./report/render.ts";
import { parseReport, ReportFormatError } from "./report/schema.ts";

const USAGE = `Usage: renovate-report-html <report.json> [-o <dir>] [--title <title>] [--endpoint <url>] [--icons <dir>]

Turn a Renovate JSON report (reportType=file) into a self-contained HTML page.

Options:
  -o, --output <dir>   Output directory (default: current directory). Writes index.html.
  -t, --title <title>  Page title (default: "Renovate report").
  --endpoint <url>     Self-hosted GitHub or GitLab, as passed to Renovate's --endpoint
                       or as the web URL. Used for repository and pull request links.
  --icons <dir>        Embed repository icons from <dir>/<repository path>.<ext>, such as
                       icons/group/app.webp. Without it, GitLab icons load from GitLab,
                       which only works for public projects.
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
      endpoint: { type: "string" },
      icons: { type: "string" },
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

  if (values.endpoint) {
    try {
      platformWebUrl(values.endpoint);
    } catch {
      console.error(`renovate-report-html: --endpoint is not a valid http(s) URL: ${values.endpoint}`);
      return 2;
    }
  }

  const report = parseReport(await readJson(input));
  let data = toReportData(report, { title: values.title, platformUrl: values.endpoint });
  if (values.icons) {
    const iconDir = resolve(values.icons);
    const entries = await readdir(iconDir, { recursive: true, withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => relative(iconDir, join(entry.parentPath, entry.name)).split(sep).join("/"));
    const result = await embedIcons(data, files, (file) => readFile(join(iconDir, file)));
    data = result.data;
    for (const warning of result.warnings) console.warn(`renovate-report-html: ${warning}`);
    console.log(`Embedded ${result.embedded} project icon${result.embedded === 1 ? "" : "s"}`);
  }
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
