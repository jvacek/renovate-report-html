import { registryLink } from "../../report/registry.ts";
import { type DepRef, type PackageUsage, type VersionCount, versionCounts } from "../../report/stats.ts";
import {
  Age,
  type Column,
  CurrentVersion,
  ExternalButton,
  SortableTable,
  StalenessLegend,
  Stat,
  Updates,
} from "../components.tsx";
import { DatasourceIcon } from "../datasource-icon.tsx";
import { href } from "../router.ts";

const columns: Column<DepRef>[] = [
  {
    label: "Repository",
    sort: (r) => r.repo,
    render: (r) => <a href={href.repo(r.repo)}>{r.repo}</a>,
  },
  { label: "Manager", sort: (r) => r.manager, render: (r) => r.manager },
  {
    label: "File",
    sort: (r) => r.packageFile,
    render: (r) => <code>{r.packageFile}</code>,
  },
  {
    label: "Type",
    sort: (r) => r.dep.depType,
    render: (r) => <span class="muted">{r.dep.depType}</span>,
  },
  {
    label: "Current",
    sort: (r) => r.dep.currentVersion ?? r.dep.currentValue,
    render: (r) => <CurrentVersion dep={r.dep} />,
  },
  {
    label: "Age",
    class: "num",
    descFirst: true,
    sort: (r) => r.dep.currentVersionAgeInDays,
    render: (r) => <Age days={r.dep.currentVersionAgeInDays} timestamp={r.dep.currentVersionTimestamp} />,
  },
  { label: "Updates", render: (r) => <Updates updates={r.dep.updates} /> },
  {
    label: "Notes",
    sort: (r) => r.dep.skipReason,
    render: (r) => r.dep.skipReason && <span class="badge skipped">skipped: {r.dep.skipReason}</span>,
  },
];

function versionColumns(top: number, distinct: number): Column<VersionCount>[] {
  return [
    {
      label: "Version",
      sort: (v) => v.version,
      render: (v) => (
        <span class="version">
          {v.version}
          {distinct > 1 && v.uses < top && <span class="badge outlier-badge">outlier</span>}
        </span>
      ),
    },
    { label: "Uses", class: "num", descFirst: true, sort: (v) => v.uses, render: (v) => v.uses },
    {
      label: "Age",
      class: "num",
      descFirst: true,
      sort: (v) => v.ageInDays,
      render: (v) => <Age days={v.ageInDays} />,
    },
    {
      label: "Repositories",
      descFirst: true,
      sort: (v) => v.repos.length,
      render: (v) => (
        <span class="badges">
          {v.repos.map((repo) => (
            <a key={repo} href={href.repo(repo)}>
              {repo}
            </a>
          ))}
        </span>
      ),
    },
  ];
}

export function PackageView({ usage }: { usage: PackageUsage }) {
  const first = usage.usages[0]?.dep;
  const links = usage.usages.find(({ dep }) => dep.sourceUrl || dep.homepage || dep.changelogUrl)?.dep;
  const registry = first && registryLink(first);
  const names = [...new Set(usage.usages.map(({ dep }) => dep.name))].filter((name) => name !== usage.name);
  const versions = versionCounts(usage);

  return (
    <>
      <p class="crumbs">
        <a href={href.packages()}>Packages</a> /
      </p>
      <h1 class="with-icon">
        <DatasourceIcon datasource={usage.datasource} />
        {usage.name}
      </h1>
      <p class="muted">
        {usage.datasource && <>Datasource {usage.datasource}. </>}
        {names.length > 0 && <>Also named {names.join(", ")}.</>}
      </p>
      <p class="actions">
        {registry && (
          <ExternalButton href={registry.url} primary>
            View on {registry.label}
          </ExternalButton>
        )}
        {links?.sourceUrl && links.sourceUrl !== registry?.url && (
          <ExternalButton href={links.sourceUrl}>Source</ExternalButton>
        )}
        {links?.homepage && <ExternalButton href={links.homepage}>Homepage</ExternalButton>}
        {links?.changelogUrl && <ExternalButton href={links.changelogUrl}>Changelog</ExternalButton>}
      </p>
      <div class="stats">
        <Stat label="Repositories" value={usage.repos.length} />
        <Stat label="Uses" value={usage.usages.length} />
        <Stat label="Versions in use" value={versions.length} tone={versions.length > 1 ? "warn" : undefined} />
        {usage.latest && <Stat label="Newest available" value={usage.latest} />}
      </div>
      <h2>Versions in use</h2>
      <SortableTable
        columns={versionColumns(versions[0]?.uses ?? 0, versions.length)}
        rows={versions}
        rowKey={(v) => v.version}
        initialSort={{ column: 1, desc: true }}
      />
      <h2>All uses</h2>
      <StalenessLegend />
      <SortableTable
        columns={columns}
        rows={usage.usages}
        rowKey={(r) => `${r.repo}:${r.packageFile}:${r.dep.depType}`}
        initialSort={{ column: 5, desc: true }}
      />
    </>
  );
}
