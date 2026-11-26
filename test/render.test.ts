import { describe, expect, it } from "vitest";
import type { ReportData } from "../src/report/data.ts";
import { DATA_PLACEHOLDER, renderHtml, serializeForScript } from "../src/report/render.ts";

const template = `<html><head><title>Renovate report</title></head><body><script id="report-data" type="application/json">${DATA_PLACEHOLDER}</script></body></html>`;

const data = (title: string): ReportData => ({
  version: 1,
  title,
  generatedAt: "2026-01-01T00:00:00.000Z",
  problems: [{ message: "</script><script>alert(1)</script> $& $1", context: {} }],
  repositories: [],
});

function embedded(html: string): unknown {
  const match = html.match(/<script id="report-data" type="application\/json">(.*?)<\/script>/s);
  return JSON.parse(match?.[1] ?? "null");
}

describe("renderHtml", () => {
  it("embeds the data so it round-trips", () => {
    const input = data("My report");
    expect(embedded(renderHtml(template, input))).toEqual(input);
  });

  it("cannot be broken out of with a closing script tag", () => {
    const html = renderHtml(template, data("x"));
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html).not.toContain("<script>alert");
  });

  it("escapes the title", () => {
    expect(renderHtml(template, data(`A & B <i>"x"</i>`))).toContain(
      "<title>A &amp; B &lt;i&gt;&quot;x&quot;&lt;/i&gt;</title>",
    );
  });

  it("fails clearly when the template has no placeholder", () => {
    expect(() => renderHtml("<html></html>", data("x"))).toThrow(/placeholder/);
  });
});

describe("serializeForScript", () => {
  it("escapes line and paragraph separators", () => {
    expect(serializeForScript("a b ")).toBe('"a\\u2028b\\u2029"');
  });
});
