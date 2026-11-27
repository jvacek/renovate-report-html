import { useMemo, useState } from "preact/hooks";
import { allOpenChanges, type OpenChange, upgradesByType } from "../../report/changes.ts";
import type { ReportData, Repository } from "../../report/data.ts";
import { buildFolderTree, type Folder } from "../../report/groups.ts";
import { changeTerms, splitRepoName } from "../../report/platform.ts";
import {
  type Column,
  changeColumns,
  changeUpdateTypes,
  plural,
  RepoLink,
  SortableTable,
  Stat,
  UpdateCounts,
  UpdateTypesLegend,
} from "../components.tsx";
import { GroupCell, type RepoView, RepoViewToggle, useRepoView } from "../repo-view.tsx";

/** One open change, or a group folder with the totals of every change below it. */
interface ChangeRow {
  /** `repo#number` for changes, the group path for folders. */
  key: string;
  /** What the Repository column shows and sorts by. */
  label: string;
  change?: OpenChange;
  folder?: { path: string; children: ChangeRow[]; first: Repository; changes: number };
  updatesByType: Record<string, number>;
  updates: number;
}

function changeRow(change: OpenChange, label: string): ChangeRow {
  return {
    key: `${change.repo.name}#${change.branch.prNo}`,
    label,
    change,
    updatesByType: upgradesByType(change.branch),
    updates: change.branch.upgrades.length,
  };
}

function folderRows(folder: Folder<OpenChange>): ChangeRow[] {
  const changes = (f: Folder<OpenChange>): OpenChange[] => [...f.items, ...f.folders.flatMap(changes)];
  return [
    ...folder.folders.map((sub): ChangeRow => {
      const all = changes(sub);
      const updatesByType: Record<string, number> = {};
      for (const change of all) {
        for (const [type, n] of Object.entries(upgradesByType(change.branch))) {
          updatesByType[type] = (updatesByType[type] ?? 0) + n;
        }
      }
      return {
        key: sub.path,
        label: sub.label,
        folder: { path: sub.path, children: folderRows(sub), first: (all[0] as OpenChange).repo, changes: all.length },
        updatesByType,
        updates: all.reduce((n, c) => n + c.branch.upgrades.length, 0),
      };
    }),
    ...folder.items.map((change) => changeRow(change, splitRepoName(change.repo.name).name)),
  ];
}

function rowsFor(changes: OpenChange[], view: RepoView): ChangeRow[] {
  if (view === "folders") return folderRows(buildFolderTree(changes, (c) => c.repo.name));
  return changes.map((c) => changeRow(c, view === "names" ? splitRepoName(c.repo.name).name : c.repo.name));
}

const childrenOf = (row: ChangeRow) => row.folder?.children;
const rowKey = (row: ChangeRow) => row.key;

/** The per-change columns, applied to change rows; folder rows leave them blank unless a total fits. */
function lift(column: Column<OpenChange>): Column<ChangeRow> {
  const { sort, render } = column;
  return {
    ...column,
    sort: sort && ((r) => (r.change ? sort(r.change) : undefined)),
    render: (r) => (r.change ? render(r.change) : null),
  };
}

function columnsFor(term: string, updateTypes: string[], data: ReportData, view: RepoView): Column<ChangeRow>[] {
  const [number, title, updates, branch] = changeColumns(term, updateTypes, data.platformUrl);
  return [
    {
      label: "Repository",
      sort: (r) => r.label,
      render: (r) =>
        r.folder ? (
          <GroupCell path={r.folder.path} label={r.label} first={r.folder.first} data={data} />
        ) : (
          r.change && <RepoLink name={r.change.repo.name} report={data} hidePath={view !== "paths"} />
        ),
    },
    {
      ...lift(number),
      render: (r) =>
        r.folder ? <span class="muted">{plural(r.folder.changes, term)}</span> : r.change && number.render(r.change),
    },
    lift(title),
    {
      ...lift(updates),
      sort: (r) => r.updates,
      render: (r) => <UpdateCounts counts={r.updatesByType} types={updateTypes} />,
    },
    lift(branch),
  ];
}

export function ChangesView({ data }: { data: ReportData }) {
  const changes = useMemo(() => allOpenChanges(data.repositories), [data]);
  const terms = changeTerms(data.repositories[0]?.platform);
  // Only offer other views when names have a path to hide or nest.
  const nested = changes.some((c) => c.repo.name.includes("/"));
  const [view, setView] = useRepoView(nested);
  const updateTypes = useMemo(() => changeUpdateTypes(changes), [changes]);
  const columns = useMemo(
    () => columnsFor(terms.short, updateTypes, data, view),
    [terms.short, updateTypes, data, view],
  );
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const rows = useMemo(() => {
    const shown = needle
      ? changes.filter((c) =>
          [c.repo.name, c.branch.prTitle, c.branch.branchName].some((v) => v?.toLowerCase().includes(needle)),
        )
      : changes;
    return rowsFor(shown, view);
  }, [changes, needle, view]);
  const repos = new Set(changes.map((c) => c.repo.name)).size;
  const updates = changes.reduce((n, c) => n + c.branch.upgrades.length, 0);

  return (
    <>
      <h1>Open {terms.long}s</h1>
      <p class="muted">Renovate {terms.long}s that are open, across all repositories.</p>
      {changes.length === 0 ? (
        <p>
          No open Renovate {terms.long}s. Renovate leaves them out of the report when run with{" "}
          <code>--dry-run=lookup</code>.
        </p>
      ) : (
        <>
          <div class="stats">
            <Stat label={`Open ${terms.short}s`} value={changes.length} />
            <Stat label="Repositories" value={repos} />
            <Stat label="Updates" value={updates} />
          </div>
          <div class="toolbar">
            <input
              type="search"
              placeholder="Filter by repository, title or branch"
              value={filter}
              onInput={(e) => setFilter(e.currentTarget.value)}
              aria-label={`Filter ${terms.long}s`}
            />
            {nested && <RepoViewToggle view={view} onChange={setView} />}
          </div>
          <UpdateTypesLegend types={updateTypes} />
          <SortableTable
            columns={columns}
            rows={rows}
            rowKey={rowKey}
            childrenOf={view === "folders" ? childrenOf : undefined}
            initialSort={{ column: 0, desc: false }}
            empty={`No ${terms.long}s match the filter.`}
          />
        </>
      )}
    </>
  );
}
