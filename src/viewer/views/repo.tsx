import { useState } from "preact/hooks";
import { type ChangesByUse, heldBackChanges, openChanges } from "../../report/changes.ts";
import type { Dep, ReportData, Repository } from "../../report/data.ts";
import { changeTerms, hasIconSlot, platformLinks, repoIcon } from "../../report/platform.ts";
import { allDeps, type DepRef, packageId } from "../../report/stats.ts";
import {
  Age,
  type Column,
  CurrentVersion,
  changeColumns,
  changesColumn,
  changeUpdateTypes,
  DepName,
  EmptyState,
  ExternalButton,
  heldBackColumns,
  Occurrences,
  ProblemList,
  plural,
  RepoAvatar,
  RepoName,
  type RowChanges,
  SortableTable,
  StalenessLegend,
  Stat,
  Updates,
  UpdateTypesLegend,
} from "../components.tsx";
import { DatasourceIcon } from "../datasource-icon.tsx";
import { href } from "../router.ts";

const baseDepColumns: Column<Dep>[] = [
  {
    label: "Dependency",
    sort: (d) => d.name,
    render: (d) => (
      <span class="with-icon">
        <DatasourceIcon datasource={d.datasource} />
        <a href={href.package(packageId(d))}>
          <DepName dep={d} />
        </a>
        <Occurrences dep={d} />
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

/** With `changes`, an open PR/MR column follows Updates. */
function depColumns(changes?: RowChanges<Dep>): Column<Dep>[] {
  if (!changes) return baseDepColumns;
  const at = baseDepColumns.findIndex((c) => c.label === "Updates") + 1;
  return [...baseDepColumns.slice(0, at), changesColumn(`Open ${changes.term}`, changes), ...baseDepColumns.slice(at)];
}

function matches(dep: Dep, filter: string, onlyUpdates: boolean): boolean {
  if (onlyUpdates && dep.updates.length === 0) return false;
  if (!filter) return true;
  const needle = filter.toLowerCase();
  return [dep.name, dep.packageName, dep.depType, dep.datasource].some((v) => v?.toLowerCase().includes(needle));
}

export function RepoView({
  repo,
  report,
  changesFor,
}: {
  repo: Repository;
  report: ReportData;
  changesFor: ChangesByUse;
}) {
  const { platformUrl } = report;
  const links = platformLinks(repo, platformUrl);
  const terms = changeTerms(repo.platform);
  const changes = openChanges(repo);
  const changeTypes = changeUpdateTypes(changes);
  const heldBack = heldBackChanges(repo);
  const heldBackTypes = changeUpdateTypes(heldBack);
  const useOf = (manager: string, packageFile: string, dep: Dep): DepRef => ({
    repo: repo.name,
    manager,
    packageFile,
    dep,
  });
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
            <EmptyState>
              No {terms.long} data. Renovate leaves it out when run with <code>--dry-run=lookup</code>, or when it has
              no branches for this repository.
            </EmptyState>
          ) : (
            <>
              {changes.length > 0 && <UpdateTypesLegend types={changeTypes} />}
              <SortableTable
                columns={changeColumns(terms.short, changeTypes, platformUrl)}
                rows={changes}
                rowKey={(c) => c.branch.branchName}
                initialSort={{ column: 0, desc: true }}
                empty={`No open Renovate ${terms.long}s.`}
              />
              {heldBack.length > 0 && (
                <>
                  <h3>Held back by limits</h3>
                  <p class="muted">
                    Renovate has these {terms.long}s ready but has not opened them, because it reached one of its
                    limits. They open on a later run once there is room.
                  </p>
                  <UpdateTypesLegend types={heldBackTypes} />
                  <SortableTable
                    columns={heldBackColumns(terms.short, heldBackTypes)}
                    rows={heldBack}
                    rowKey={(c) => c.branch.branchName}
                    initialSort={{ column: 0, desc: false }}
                  />
                </>
              )}
            </>
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
                    columns={depColumns(
                      changes.length + heldBack.length > 0
                        ? {
                            open: (dep) => changesFor.open(useOf(manager.name, file.path, dep)),
                            heldBack: (dep) => changesFor.heldBack(useOf(manager.name, file.path, dep)),
                            term: terms.short,
                            platformUrl,
                          }
                        : undefined,
                    )}
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
