/**
 * Dev server only: load a raw report from fixtures/ and run the same parse and
 * transform as the CLI. Pick a fixture with `?fixture=<name>`, for example
 * `?fixture=github-report-full` or `?fixture=private/my-report`.
 */
import { toReportData } from "../report/data.ts";
import { parseReport } from "../report/schema.ts";

const fixtures = import.meta.glob<unknown>("../../fixtures/**/*.json", {
  import: "default",
});

export async function loadDevFixture() {
  const name = new URLSearchParams(location.search).get("fixture") ?? "github-report";
  const load = fixtures[`../../fixtures/${name}.json`];
  if (!load) {
    const available = Object.keys(fixtures).map((path) => path.replace(/^.*fixtures\/|\.json$/g, ""));
    throw new Error(`Unknown fixture "${name}". Available: ${available.join(", ")}`);
  }
  return toReportData(parseReport(await load()), { title: `Dev: ${name}` });
}
