/**
 * Dev server only: load a raw report from fixtures/ and run the same parse and
 * transform as the CLI. Pick a fixture with `?fixture=<name>`, for example
 * `?fixture=github-report-full` or `?fixture=private/my-report`. Icons in
 * `fixtures/<name>-icons/`, laid out as for `--icons`, show as if embedded.
 */
import { type ReportData, toReportData } from "../report/data.ts";
import { groupPaths } from "../report/groups.ts";
import { matchIconFiles } from "../report/icons.ts";
import { parseReport } from "../report/schema.ts";

const fixtures = import.meta.glob<unknown>("../../fixtures/**/*.json", {
  import: "default",
});

const iconUrls = import.meta.glob<string>("../../fixtures/**/*-icons/**/*.{png,jpg,jpeg,gif,webp,ico,bmp}", {
  query: "?url",
  import: "default",
  eager: true,
});

export async function loadDevFixture() {
  const name = new URLSearchParams(location.search).get("fixture") ?? "github-report";
  const load = fixtures[`../../fixtures/${name}.json`];
  if (!load) {
    const available = Object.keys(fixtures).map((path) => path.replace(/^.*fixtures\/|\.json$/g, ""));
    throw new Error(`Unknown fixture "${name}". Available: ${available.join(", ")}`);
  }
  return withIcons(toReportData(parseReport(await load()), { title: `Dev: ${name}` }), name);
}

function withIcons(data: ReportData, name: string): ReportData {
  const dir = `../../fixtures/${name}-icons/`;
  const files = Object.keys(iconUrls)
    .filter((path) => path.startsWith(dir))
    .map((path) => path.slice(dir.length));
  if (files.length === 0) return data;
  const repoNames = data.repositories.map((repo) => repo.name);
  const groups = groupPaths(repoNames);
  const url = new Map<string, string>();
  for (const [key, file] of matchIconFiles(files, [...repoNames, ...groups])) {
    const found = iconUrls[dir + file];
    if (found) url.set(key, found);
  }
  return {
    ...data,
    embeddedIcons: true,
    groupIcons: Object.fromEntries([...url].filter(([key]) => groups.includes(key))),
    repositories: data.repositories.map((repo) => ({ ...repo, icon: url.get(repo.name) })),
  };
}
