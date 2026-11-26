/**
 * Builds the real viewer and CLI, renders the fixture, and runs the page in
 * happy-dom to check it boots and shows the data.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Browser } from "happy-dom";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pkg from "../package.json" with { type: "json" };

const root = new URL("..", import.meta.url).pathname;
const outDir = mkdtempSync(join(tmpdir(), "renovate-report-html-"));
let html = "";

beforeAll(() => {
  const bin = (name: string) => join(root, "node_modules", ".bin", name);
  // Vitest sets NODE_ENV=test; build the way `pnpm build` does.
  const env = { ...process.env, NODE_ENV: "production" };
  execFileSync(bin("vite"), ["build", "--logLevel", "error"], { cwd: root, env });
  execFileSync(bin("tsdown"), ["--logLevel", "error"], { cwd: root, env });
  execFileSync(
    process.execPath,
    ["dist/cli.mjs", "fixtures/github-report.json", "-o", outDir, "--title", "Smoke <test>"],
    { cwd: root },
  );
  html = readFileSync(join(outDir, "index.html"), "utf8");
}, 60_000);

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

/** Load the page in happy-dom (our own build, so evaluating its script is fine). */
async function boot(hash: string) {
  const browser = new Browser({
    settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true },
  });
  const page = browser.newPage();
  page.url = `http://localhost/index.html${hash}`;
  page.content = html;
  await page.waitUntilComplete();
  return {
    document: page.mainFrame.document,
    console: page.virtualConsolePrinter,
    waitUntilComplete: () => page.waitUntilComplete(),
    close: () => browser.close(),
  };
}

describe("rendered page", () => {
  it("is a single self-contained file with the data embedded", () => {
    expect(html).toContain("<title>Smoke &lt;test&gt;</title>");
    expect(html).toContain('"name":"expressjs/express"');
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+stylesheet/);
    expect(html).not.toContain("loadDevFixture");
  });

  it("boots and renders the overview", async () => {
    const page = await boot("#/");
    expect(page.console.readAsString()).toBe("");
    expect(page.document.querySelector("h1")?.textContent).toBe("Overview");
    expect(page.document.body.textContent).toContain("527");
    const footer = page.document.querySelector("footer");
    expect(footer?.textContent).toContain(`v${pkg.version}`);
    expect(footer?.querySelector("a")?.getAttribute("href")).toBe("https://github.com/jvacek/renovate-report-html");
    await page.close();
  });

  it("lists every repository on the repositories page", async () => {
    const page = await boot("#/repos");
    expect(page.document.querySelectorAll("tbody a")).toHaveLength(5);
    await page.close();
  });

  it("nests repositories in folders that collapse by default", async () => {
    const page = await boot("#/repos");
    const buttons = () => [...page.document.querySelectorAll("button")];
    expect(
      buttons()
        .find((b) => b.textContent === "Folders")
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    const toggles = buttons().filter((b) => b.classList.contains("tree-toggle"));
    expect(toggles.length).toBeGreaterThan(0);
    const rows = page.document.querySelectorAll("tbody tr").length;
    expect(rows).toBe(5 + toggles.length);
    toggles[0]?.click();
    await page.waitUntilComplete();
    expect(page.document.querySelectorAll("tbody tr").length).toBeLessThan(rows);
    await page.close();
  });

  it("shows full paths when chosen", async () => {
    const page = await boot("#/repos");
    [...page.document.querySelectorAll("button")].find((b) => b.textContent === "Full paths")?.click();
    await page.waitUntilComplete();
    expect(page.document.querySelectorAll("tbody tr")).toHaveLength(5);
    expect(page.document.querySelector("tbody")?.textContent).toContain("pallets/flask");
    await page.close();
  });

  it("renders a repository from a deep link", async () => {
    const page = await boot(`#/repo/${encodeURIComponent("pallets/flask")}`);
    expect(page.document.querySelector("h1")?.textContent).toBe("pallets/flask");
    await page.close();
  });
});
