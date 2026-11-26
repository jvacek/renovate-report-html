import type { ReportData } from "./data.ts";

/** Marker inside the viewer's `<script id="report-data">` tag that the CLI replaces. */
export const DATA_PLACEHOLDER = "__RENOVATE_REPORT_DATA__";

const DATA_TAG = `<script id="report-data" type="application/json">${DATA_PLACEHOLDER}</script>`;

/**
 * Serialise data so it is safe inside a `<script>` element: escaping `<` rules
 * out `</script>` and `<!--`, and U+2028/U+2029 are escaped for old parsers.
 */
export function serializeForScript(data: unknown): string {
  return JSON.stringify(data).replaceAll("<", "\\u003c").replaceAll(" ", "\\u2028").replaceAll(" ", "\\u2029");
}

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** Put the report data and page title into the prebuilt viewer template. */
export function renderHtml(template: string, data: ReportData): string {
  if (!template.includes(DATA_TAG)) {
    throw new Error("Viewer template is missing the report data placeholder. Was it built with `pnpm build`?");
  }
  // Replacer functions keep `$` sequences in the data from being treated as patterns.
  return template
    .replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(data.title)}</title>`)
    .replace(DATA_TAG, () => DATA_TAG.split(DATA_PLACEHOLDER).join(serializeForScript(data)));
}
