import { useMemo } from "preact/hooks";
import { allHeldBackChanges, allOpenChanges, type ChangesByUse, changesByUse } from "../report/changes.ts";
import type { ReportData } from "../report/data.ts";
import { changeTerms } from "../report/platform.ts";
import { type PackageUsage, packageIndex, type Summary, summarize } from "../report/stats.ts";
import { ProblemCount } from "./components.tsx";
import { href, type Route, useRoute } from "./router.ts";
import { ThemeSwitcher } from "./theme-switcher.tsx";
import { ChangesView } from "./views/changes.tsx";
import { Overview } from "./views/overview.tsx";
import { PackageView } from "./views/package.tsx";
import { PackagesView } from "./views/packages.tsx";
import { ProblemsView } from "./views/problems.tsx";
import { RepoView } from "./views/repo.tsx";
import { ReposView } from "./views/repos.tsx";

export function App({ data }: { data: ReportData }) {
  const route = useRoute();
  const summary = useMemo(() => summarize(data), [data]);
  const packages = useMemo(() => packageIndex(data.repositories), [data]);
  const changesFor = useMemo(() => changesByUse(data.repositories), [data]);
  const openChangeCount = useMemo(() => allOpenChanges(data.repositories).length, [data]);
  const heldBackCount = useMemo(() => allHeldBackChanges(data.repositories).length, [data]);
  const terms = changeTerms(data.repositories[0]?.platform);

  return (
    <>
      <header class="topbar">
        <a class="brand" href={href.overview()}>
          {data.title}
        </a>
        <nav>
          <NavLink route={route} to="overview" label="Overview" />
          <NavLink route={route} to="repos" label="Repositories" />
          <NavLink route={route} to="packages" label="Packages" />
          {/* Lookup and local runs have no branch data, so the page would always be empty. */}
          {openChangeCount + heldBackCount > 0 && (
            <NavLink route={route} to="changes" label={`Open ${terms.short}s`} count={openChangeCount} />
          )}
          <NavLink route={route} to="problems" label="Problems" problems={summary.problems} />
        </nav>
        <ThemeSwitcher />
      </header>
      <main class="page">
        <Page data={data} route={route} summary={summary} packages={packages} changesFor={changesFor} />
      </main>
      <footer class="footer muted">
        Generated {new Date(data.generatedAt).toLocaleString()} from a Renovate report by{" "}
        <a href={__REPO_URL__}>renovate-report-html</a> v{__APP_VERSION__}.
      </footer>
    </>
  );
}

function NavLink({
  route,
  to,
  label,
  count,
  problems,
}: {
  route: Route;
  to: "overview" | "repos" | "packages" | "changes" | "problems";
  label: string;
  count?: number;
  /** A problem count, drawn as the problem badge instead of a plain count. */
  problems?: number;
}) {
  const active =
    route.name === to || (to === "packages" && route.name === "package") || (to === "repos" && route.name === "repo");
  return (
    <a href={href[to]()} class={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
      {label}
      {count ? <span class="badge nav-count">{count}</span> : null}
      {problems ? <ProblemCount count={problems} after /> : null}
    </a>
  );
}

function Page({
  data,
  route,
  summary,
  packages,
  changesFor,
}: {
  data: ReportData;
  route: Route;
  summary: Summary;
  packages: PackageUsage[];
  changesFor: ChangesByUse;
}) {
  switch (route.name) {
    case "overview":
      return <Overview data={data} summary={summary} />;
    case "repos":
      return <ReposView data={data} />;
    case "repo": {
      const repo = data.repositories.find((r) => r.name === route.repo);
      return repo ? (
        <RepoView repo={repo} report={data} changesFor={changesFor} />
      ) : (
        <NotFound what={`repository ${route.repo}`} />
      );
    }
    case "packages":
      return <PackagesView packages={packages} filter={route} />;
    case "package": {
      const usage = packages.find((p) => p.id === route.id);
      return usage ? (
        <PackageView usage={usage} changesFor={changesFor} report={data} />
      ) : (
        <NotFound what={`package ${route.id}`} />
      );
    }
    case "changes":
      return <ChangesView data={data} />;
    case "problems":
      return <ProblemsView data={data} />;
    case "notFound":
      return <NotFound what={`page /${route.path}`} />;
  }
}

function NotFound({ what }: { what: string }) {
  return (
    <section>
      <h1>Not found</h1>
      <p>
        There is no {what} in this report. <a href={href.overview()}>Back to the overview</a>.
      </p>
    </section>
  );
}
