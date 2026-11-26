import { useMemo } from "preact/hooks";
import type { ReportData } from "../report/data.ts";
import { type PackageUsage, packageIndex, type Summary, summarize } from "../report/stats.ts";
import { href, type Route, useRoute } from "./router.ts";
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
          <NavLink route={route} to="problems" label="Problems" count={summary.problems} />
        </nav>
      </header>
      <main class="page">
        <Page data={data} route={route} summary={summary} packages={packages} />
      </main>
      <footer class="footer muted">
        Generated {new Date(data.generatedAt).toLocaleString()} from a Renovate report by renovate-report-html.
      </footer>
    </>
  );
}

function NavLink({
  route,
  to,
  label,
  count,
}: {
  route: Route;
  to: "overview" | "repos" | "packages" | "problems";
  label: string;
  count?: number;
}) {
  const active =
    route.name === to || (to === "packages" && route.name === "package") || (to === "repos" && route.name === "repo");
  return (
    <a href={href[to]()} class={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
      {label}
      {count ? <span class="badge level-warn nav-count">{count}</span> : null}
    </a>
  );
}

function Page({
  data,
  route,
  summary,
  packages,
}: {
  data: ReportData;
  route: Route;
  summary: Summary;
  packages: PackageUsage[];
}) {
  switch (route.name) {
    case "overview":
      return <Overview data={data} summary={summary} />;
    case "repos":
      return <ReposView repositories={data.repositories} />;
    case "repo": {
      const repo = data.repositories.find((r) => r.name === route.repo);
      return repo ? <RepoView repo={repo} /> : <NotFound what={`repository ${route.repo}`} />;
    }
    case "packages":
      return <PackagesView packages={packages} filter={route} />;
    case "package": {
      const usage = packages.find((p) => p.id === route.id);
      return usage ? <PackageView usage={usage} /> : <NotFound what={`package ${route.id}`} />;
    }
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
