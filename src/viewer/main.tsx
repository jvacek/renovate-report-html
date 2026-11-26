import { render } from "preact";
import { DATA_VERSION, type ReportData } from "../report/data.ts";
import { DATA_PLACEHOLDER } from "../report/render.ts";
import { App } from "./app.tsx";
import "./styles.css";

async function loadData(): Promise<ReportData> {
  const text = document.getElementById("report-data")?.textContent?.trim() ?? "";
  if (text === DATA_PLACEHOLDER) {
    if (__DEV_SERVER__) {
      const { loadDevFixture } = await import("./dev-fixture.ts");
      return loadDevFixture();
    }
    throw new Error("This is the empty viewer template. Generate a page with the renovate-report-html CLI.");
  }
  const data = JSON.parse(text) as ReportData;
  if (data.version !== DATA_VERSION) {
    throw new Error(`Unsupported data version ${data.version}. Regenerate the page with a matching CLI version.`);
  }
  return data;
}

/** Browsers defer inline module scripts, but don't rely on it: the data tag comes after this script. */
function domReady(): Promise<void> {
  if (document.readyState !== "loading") return Promise.resolve();
  return new Promise((resolve) => document.addEventListener("DOMContentLoaded", () => resolve(), { once: true }));
}

function show(content: preact.ComponentChild) {
  render(content, document.getElementById("app") as HTMLElement);
}

domReady()
  .then(loadData)
  .then(
    (data) => {
      document.title = data.title;
      show(<App data={data} />);
    },
    (error: unknown) => {
      show(
        <main class="page">
          <h1>Could not load the report</h1>
          <pre class="error">{error instanceof Error ? error.message : String(error)}</pre>
        </main>,
      );
    },
  );
