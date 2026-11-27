import { useMemo } from "preact/hooks";
import { type PackageUsage, type VersionCount, versionCounts } from "../../report/stats.ts";
import { Age, type Column, Count, SortableTable, StalenessLegend } from "../components.tsx";
import { DatasourceIcon } from "../datasource-icon.tsx";
import { href, type PackageFilter, replaceHash } from "../router.ts";

interface PackageRow {
  usage: PackageUsage;
  versions: VersionCount[];
}

/** Versions with use counts, outliers highlighted. */
export function VersionChips({ versions }: { versions: VersionCount[] }) {
  return (
    <span class="version-chips">
      {versions.map((v) => (
        <span
          key={v.version}
          class={`version-chip ${v.outlier ? "outlier" : ""}`}
          title={`${v.uses} ${v.uses === 1 ? "use" : "uses"} in ${v.repos.join(", ")}`}
        >
          <span class="version">{v.version}</span>
          <span class="count">×{v.uses}</span>
        </span>
      ))}
    </span>
  );
}

const columns: Column<PackageRow>[] = [
  {
    label: "Package",
    sort: (r) => r.usage.name,
    render: (r) => (
      <span class="with-icon">
        <DatasourceIcon datasource={r.usage.datasource} />
        <a href={href.package(r.usage.id)}>{r.usage.name}</a>
      </span>
    ),
  },
  {
    label: "Datasource",
    sort: (r) => r.usage.datasource,
    render: (r) => <span class="muted">{r.usage.datasource}</span>,
  },
  {
    label: "Repos",
    class: "num",
    descFirst: true,
    sort: (r) => r.usage.repos.length,
    render: (r) => <Count value={r.usage.repos.length} />,
  },
  {
    label: "Uses",
    class: "num",
    descFirst: true,
    sort: (r) => r.usage.usages.length,
    render: (r) => <Count value={r.usage.usages.length} />,
  },
  {
    label: "Versions in use",
    descFirst: true,
    sort: (r) => r.versions.length,
    render: (r) => <VersionChips versions={r.versions} />,
  },
  { label: "Newest available", render: (r) => <span class="version">{r.usage.latest}</span> },
  {
    label: "Oldest in use",
    class: "num",
    descFirst: true,
    sort: (r) => r.usage.maxAgeInDays,
    render: (r) => <Age days={r.usage.maxAgeInDays} />,
  },
];

export function PackagesView({ packages, filter }: { packages: PackageUsage[]; filter: PackageFilter }) {
  const rows = useMemo(() => packages.map((usage) => ({ usage, versions: versionCounts(usage) })), [packages]);
  const datasourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of packages) counts.set(p.datasource ?? "unknown", (counts.get(p.datasource ?? "unknown") ?? 0) + 1);
    // Alphabetical, so a datasource is easy to find; "unknown" goes last.
    return [...counts].sort(
      (a, b) => Number(a[0] === "unknown") - Number(b[0] === "unknown") || a[0].localeCompare(b[0]),
    );
  }, [packages]);

  const needle = filter.query.trim().toLowerCase();
  const filtered = rows.filter(
    ({ usage }) =>
      (filter.datasources.length === 0 || filter.datasources.includes(usage.datasource ?? "unknown")) &&
      (!needle || usage.name.toLowerCase().includes(needle)),
  );
  const update = (next: Partial<PackageFilter>) => replaceHash(href.packages({ ...filter, ...next }));
  const toggle = (ds: string) =>
    update({
      datasources: filter.datasources.includes(ds)
        ? filter.datasources.filter((d) => d !== ds)
        : [...filter.datasources, ds],
    });

  return (
    <>
      <h1>Packages</h1>
      <p class="muted">Every package across all repositories, with the versions each repository is on.</p>
      <div class="toolbar">
        <input
          type="search"
          placeholder="Search packages"
          value={filter.query}
          onInput={(e) => update({ query: e.currentTarget.value })}
          aria-label="Search packages"
          // biome-ignore lint/a11y/noAutofocus: search is the point of this page
          autoFocus
        />
        <span class="muted">
          {filtered.length} of {packages.length}
        </span>
      </div>
      <fieldset class="filter-chips">
        <legend class="muted">Datasource</legend>
        {datasourceCounts.map(([ds, count]) => (
          <button
            key={ds}
            type="button"
            class="filter-chip"
            aria-pressed={filter.datasources.includes(ds)}
            onClick={() => toggle(ds)}
          >
            <DatasourceIcon datasource={ds === "unknown" ? undefined : ds} />
            {ds} <span class="count">{count}</span>
          </button>
        ))}
        {filter.datasources.length > 0 && (
          <button type="button" class="filter-clear" onClick={() => update({ datasources: [] })}>
            Clear
          </button>
        )}
      </fieldset>
      <StalenessLegend />
      <SortableTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.usage.id}
        initialSort={{ column: 2, desc: true }}
        empty="No packages match this search."
      />
    </>
  );
}
