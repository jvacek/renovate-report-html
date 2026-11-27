import type { OpenChange } from "../../report/changes.ts";
import type { ReportData } from "../../report/data.ts";
import { changeTerms } from "../../report/platform.ts";
import { registryLink } from "../../report/registry.ts";
import {
  type DepRef,
  isBehind,
  newestInUse,
  type PackageUsage,
  type VersionCount,
  versionCounts,
} from "../../report/stats.ts";
import {
  Age,
  ChangeLink,
  type Column,
  Count,
  CurrentVersion,
  ExternalButton,
  RepoLink,
  RepoList,
  SortableTable,
  StalenessLegend,
  Stat,
  Updates,
} from "../components.tsx";
import { DatasourceIcon } from "../datasource-icon.tsx";
import { href } from "../router.ts";

function baseColumns(newest: string | undefined, report: ReportData): Column<DepRef>[] {
  return [
    {
      label: "Repository",
      sort: (r) => r.repo,
      render: (r) => <RepoLink name={r.repo} report={report} />,
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
      render: (r) =>
        isBehind(r.dep, newest) ? (
          <span class="behind" title={`Behind ${newest}, the newest version in use`}>
            <CurrentVersion dep={r.dep} />
          </span>
        ) : (
          <CurrentVersion dep={r.dep} />
        ),
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
}

function changesColumn(label: string, changesFor: (ref: DepRef) => OpenChange[], platformUrl?: string): Column<DepRef> {
  return {
    label,
    descFirst: true,
    sort: (r) => changesFor(r)[0]?.branch.prNo,
    render: (r) =>
      changesFor(r).map((change, i) => (
        <span key={change.branch.branchName}>
          {i > 0 && ", "}
          <ChangeLink change={change} platformUrl={platformUrl} />
        </span>
      )),
  };
}

const versionColumns = (report: ReportData): Column<VersionCount>[] => [
  {
    label: "Version",
    sort: (v) => v.version,
    render: (v) => (
      <span class="version">
        {v.version}
        {v.outlier && <span class="badge outlier-badge">outlier</span>}
      </span>
    ),
  },
  { label: "Uses", class: "num", descFirst: true, sort: (v) => v.uses, render: (v) => <Count value={v.uses} /> },
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
    render: (v) => <RepoList repos={v.repos} report={report} />,
  },
];

export function PackageView({
  usage,
  changesFor,
  report,
}: {
  usage: PackageUsage;
  changesFor: (ref: DepRef) => OpenChange[];
  report: ReportData;
}) {
  const changes = usage.usages.flatMap(changesFor);
  const changeCount = new Set(changes.map((c) => `${c.repo.name}#${c.branch.prNo}`)).size;
  const terms = changeTerms(changes[0]?.repo.platform);
  const base = baseColumns(newestInUse(usage), report);
  const columns = changeCount
    ? [...base.slice(0, 7), changesColumn(`Open ${terms.short}`, changesFor, report.platformUrl), ...base.slice(7)]
    : base;
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
        {changeCount > 0 && <Stat label={`Open Renovate ${terms.short}s`} value={changeCount} />}
      </div>
      <h2>Versions in use</h2>
      <SortableTable
        columns={versionColumns(report)}
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
