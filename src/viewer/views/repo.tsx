import { useState } from "preact/hooks";
import { type OpenChange, openChanges } from "../../report/changes.ts";
import type { Dep, ReportData, Repository } from "../../report/data.ts";
import { changeTerms, hasIconSlot, platformLinks, repoIcon } from "../../report/platform.ts";
import { allDeps, packageId } from "../../report/stats.ts";
import {
  Age,
  ChangeLink,
  type Column,
  CurrentVersion,
  ExternalButton,
  orderUpdateTypes,
  ProblemList,
  plural,
  RepoAvatar,
  RepoName,
  SortableTable,
  StalenessLegend,
  Stat,
  UpdateBadge,
  Updates,
} from "../components.tsx";
import { DatasourceIcon } from "../datasource-icon.tsx";
import { href } from "../router.ts";

const depColumns: Column<Dep>[] = [
  {
    label: "Dependency",
    sort: (d) => d.name,
    render: (d) => (
      <span class="with-icon">
        <DatasourceIcon datasource={d.datasource} />
        <a href={href.package(packageId(d))}>{d.name}</a>
      </span>
    ),
  },
  {
    label: "Type",
    sort: (d) => d.depType,
    render: (d) => <span class="muted">{d.depType}</span>,
  },
  { label: "Current", render: (d) => <CurrentVersion dep={d} /> },
  {
    label: "Age",
    class: "num",
    descFirst: true,
    sort: (d) => d.currentVersionAgeInDays,
    render: (d) => <Age days={d.currentVersionAgeInDays} timestamp={d.currentVersionTimestamp} />,
  },
  {
    label: "Updates",
    descFirst: true,
    sort: (d) => d.updates.length,
    render: (d) => <Updates updates={d.updates} />,
  },
  {
    label: "Notes",
    sort: (d) => d.skipReason,
    render: (d) => (
      <>
        {d.skipReason && <span class="badge skipped">skipped: {d.skipReason}</span>}
        {d.warnings.map((warning) => (
          <div key={warning} class="warning">
            {warning}
          </div>
        ))}
      </>
    ),
  },
];

function changeColumns(term: string, platformUrl?: string): Column<OpenChange>[] {
  return [
    {
      label: term,
      class: "num",
      descFirst: true,
      sort: (c) => c.branch.prNo,
      render: (c) => <ChangeLink change={c} platformUrl={platformUrl} />,
    },
    { label: "Title", sort: (c) => c.branch.prTitle, render: (c) => c.branch.prTitle },
    {
      label: "Updates",
      descFirst: true,
      sort: (c) => c.branch.upgrades.length,
      render: (c) => (
        <span class="badges">
          {orderUpdateTypes(c.branch.upgrades.map((u) => u.updateType ?? "unknown")).map((type) => (
            <UpdateBadge key={type} type={type} />
          ))}{" "}
          {plural(c.branch.upgrades.length, "update")}
        </span>
      ),
    },
    {
      label: "Branch",
      sort: (c) => c.branch.branchName,
      render: (c) => (
        <>
          <code>{c.branch.branchName}</code>
          {c.branch.baseBranch && <span class="muted"> into {c.branch.baseBranch}</span>}
        </>
      ),
    },
  ];
}

function matches(dep: Dep, filter: string, onlyUpdates: boolean): boolean {
  if (onlyUpdates && dep.updates.length === 0) return false;
  if (!filter) return true;
  const needle = filter.toLowerCase();
  return [dep.name, dep.packageName, dep.depType, dep.datasource].some((v) => v?.toLowerCase().includes(needle));
}

export function RepoView({ repo, report }: { repo: Repository; report: ReportData }) {
  const { platformUrl } = report;
  const links = platformLinks(repo, platformUrl);
  const terms = changeTerms(repo.platform);
  const changes = openChanges(repo);
  const [filter, setFilter] = useState("");
  const [onlyUpdates, setOnlyUpdates] = useState(false);
  const deps = [...allDeps([repo])].map((ref) => ref.dep);
  const outdated = deps.filter((d) => d.updates.length > 0).length;
  const updates = deps.reduce((n, d) => n + d.updates.length, 0);
  const meta = [
    repo.platform,
    repo.defaultBranch && `default branch ${repo.defaultBranch}`,
    repo.status,
    repo.configFileName,
  ];

  return (
    <>
      <p class="crumbs">
        <a href={href.repos()}>Repositories</a> /
      </p>
      <h1 class={hasIconSlot(repo, report) ? "with-icon" : undefined}>
        {hasIconSlot(repo, report) && <RepoAvatar key={repo.name} url={repoIcon(repo, report)} name={repo.name} />}
        <span>
          <RepoName name={repo.name} />
        </span>
      </h1>
      {meta.some(Boolean) && <p class="muted">{meta.filter(Boolean).join(" · ")}</p>}
      {links && (
        <p class="actions">
          <ExternalButton href={links.repo} primary>
            Open repository
          </ExternalButton>
          <ExternalButton href={links.changes}>{links.changesLabel}</ExternalButton>
        </p>
      )}
      <div class="stats">
        <Stat label="Managers" value={repo.managers.length} />
        <Stat label="Dependencies" value={deps.length} />
        <Stat label="With updates" value={outdated} />
        <Stat label="Pending updates" value={updates} />
        {repo.libYears !== undefined && <Stat label="Libyears" value={repo.libYears.toFixed(1)} />}
        <Stat label="Problems" value={repo.problems.length} tone={repo.problems.length ? "warn" : undefined} />
      </div>

      {repo.problems.length > 0 && (
        <section class="callout callout-warn">
          <h2>Problems</h2>
          <ProblemList problems={repo.problems} />
        </section>
      )}

      {repo.platform !== "local" && (
        <section>
          <h2>Open Renovate {terms.long}s</h2>
          {repo.branches.length === 0 ? (
            <p class="muted">
              No {terms.long} data. Renovate leaves it out when run with <code>--dry-run=lookup</code>, or when it has
              no branches for this repository.
            </p>
          ) : (
            <SortableTable
              columns={changeColumns(terms.short, platformUrl)}
              rows={changes}
              rowKey={(c) => c.branch.branchName}
              initialSort={{ column: 0, desc: true }}
              empty={`No open Renovate ${terms.long}s.`}
            />
          )}
        </section>
      )}

      <section>
        <h2>Dependencies</h2>
        <div class="toolbar">
          <input
            type="search"
            placeholder="Filter by name, type or datasource"
            value={filter}
            onInput={(e) => setFilter(e.currentTarget.value)}
            aria-label="Filter dependencies"
          />
          <label>
            <input type="checkbox" checked={onlyUpdates} onChange={(e) => setOnlyUpdates(e.currentTarget.checked)} />{" "}
            Only with updates
          </label>
          <span class="muted">
            Managers:{" "}
            {repo.managers.map((m, i) => (
              <span key={m.name}>
                {i > 0 && ", "}
                <a href={`#manager-${m.name}`} onClick={(e) => scrollToId(e, `manager-${m.name}`)}>
                  {m.name}
                </a>
              </span>
            ))}
          </span>
        </div>
        <StalenessLegend />
        {repo.managers.map((manager) => {
          const files = manager.packageFiles
            .map((file) => ({
              ...file,
              shown: file.deps.filter((d) => matches(d, filter, onlyUpdates)),
            }))
            .filter((file) => file.shown.length > 0 || (!filter && !onlyUpdates));
          if (files.length === 0) return null;
          return (
            <section key={manager.name} id={`manager-${manager.name}`} class="manager">
              <h3>
                {manager.name} <span class="muted">{plural(manager.packageFiles.length, "file")}</span>
              </h3>
              {files.map((file) => (
                <details key={file.path} open class="package-file">
                  <summary>
                    <code>{file.path}</code>{" "}
                    <span class="muted">
                      {plural(file.deps.length, "dep")}
                      {file.lockFiles?.length ? `, lock: ${file.lockFiles.join(", ")}` : ""}
                    </span>
                  </summary>
                  <SortableTable
                    columns={depColumns}
                    rows={file.shown}
                    rowKey={(d) => `${d.depType}:${d.name}:${d.currentValue}`}
                    initialSort={{ column: 3, desc: true }}
                    empty="No dependencies found in this file."
                  />
                </details>
              ))}
            </section>
          );
        })}
      </section>
    </>
  );
}

/** In-page jump that leaves the hash route alone. */
function scrollToId(event: Event, id: string) {
  event.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}
