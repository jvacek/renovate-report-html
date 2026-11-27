import { useMemo, useState } from "preact/hooks";
import { allHeldBackChanges, allOpenChanges, upgradesByType } from "../../report/changes.ts";
import type { Branch, ReportData, Repository } from "../../report/data.ts";
import { buildFolderTree, type Folder } from "../../report/groups.ts";
import { changeTerms, splitRepoName } from "../../report/platform.ts";
import {
  type Column,
  changeColumns,
  changeUpdateTypes,
  EmptyState,
  heldBackColumns,
  plural,
  RepoLink,
  SortableTable,
  Stat,
  UpdateCounts,
} from "../components.tsx";
import { GroupCell, type RepoView, RepoViewToggle, useRepoView } from "../repo-view.tsx";

/** A change: open, or held back by a limit. */
type Change = { repo: Repository; branch: Branch };

/** One change, or a group folder with the totals of every change below it. */
interface Row<T extends Change> {
  /** The branch for changes, the group path for folders. */
  key: string;
  /** What the Repository column shows and sorts by. */
  label: string;
  change?: T;
  folder?: { path: string; children: Row<T>[]; first: Repository; changes: number };
  updatesByType: Record<string, number>;
  updates: number;
}

function changeRow<T extends Change>(change: T, label: string): Row<T> {
  return {
    key: `${change.repo.name}:${change.branch.branchName}`,
    label,
    change,
    updatesByType: upgradesByType(change.branch),
    updates: change.branch.upgrades.length,
  };
}

function folderRows<T extends Change>(folder: Folder<T>): Row<T>[] {
  const changes = (f: Folder<T>): T[] => [...f.items, ...f.folders.flatMap(changes)];
  return [
    ...folder.folders.map((sub): Row<T> => {
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
        folder: { path: sub.path, children: folderRows(sub), first: (all[0] as T).repo, changes: all.length },
        updatesByType,
        updates: all.reduce((n, c) => n + c.branch.upgrades.length, 0),
      };
    }),
    ...folder.items.map((change) => changeRow(change, splitRepoName(change.repo.name).name)),
  ];
}

function rowsFor<T extends Change>(changes: T[], view: RepoView): Row<T>[] {
  if (view === "folders") return folderRows(buildFolderTree(changes, (c) => c.repo.name));
  return changes.map((c) => changeRow(c, view === "names" ? splitRepoName(c.repo.name).name : c.repo.name));
}

/** A per-change column, applied to change rows; folder rows leave it blank. */
function lift<T extends Change>(column: Column<T>): Column<Row<T>> {
  const { sort, render } = column;
  return {
    ...column,
    sort: sort && ((r) => (r.change ? sort(r.change) : undefined)),
    render: (r) => (r.change ? render(r.change) : null),
  };
}

/**
 * Repository, then the per-change columns. Folder rows show their change count in the first of
 * those and their summed update counts under Updates.
 */
function treeColumns<T extends Change>(
  perChange: Column<T>[],
  { term, updateTypes, data, view }: { term: string; updateTypes: string[]; data: ReportData; view: RepoView },
): Column<Row<T>>[] {
  const [first, ...rest] = perChange.map(lift);
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
    ...(first
      ? [
          {
            ...first,
            render: (r: Row<T>) =>
              r.folder ? <span class="muted">{plural(r.folder.changes, term)}</span> : first.render(r),
          },
        ]
      : []),
    ...rest.map(
      (column): Column<Row<T>> =>
        column.label === "Updates"
          ? {
              ...column,
              sort: (r) => r.updates,
              render: (r) => <UpdateCounts counts={r.updatesByType} types={updateTypes} />,
            }
          : column,
    ),
  ];
}

const childrenOf = <T extends Change>(row: Row<T>) => row.folder?.children;
const rowKey = <T extends Change>(row: Row<T>) => row.key;

function ChangeTable<T extends Change>({
  changes,
  perChange,
  term,
  data,
  view,
}: {
  changes: T[];
  perChange: (updateTypes: string[]) => Column<T>[];
  term: string;
  data: ReportData;
  view: RepoView;
}) {
  const updateTypes = useMemo(() => changeUpdateTypes(changes), [changes]);
  const columns = useMemo(
    () => treeColumns(perChange(updateTypes), { term, updateTypes, data, view }),
    [perChange, updateTypes, term, data, view],
  );
  const rows = useMemo(() => rowsFor(changes, view), [changes, view]);
  return (
    <SortableTable
      columns={columns}
      rows={rows}
      rowKey={rowKey}
      childrenOf={view === "folders" ? childrenOf : undefined}
      initialSort={{ column: 0, desc: false }}
      empty="Nothing matches the filter."
    />
  );
}

function matches(change: Change, needle: string): boolean {
  return [change.repo.name, change.branch.prTitle, change.branch.branchName].some((v) =>
    v?.toLowerCase().includes(needle),
  );
}

export function ChangesView({ data }: { data: ReportData }) {
  const open = useMemo(() => allOpenChanges(data.repositories), [data]);
  const heldBack = useMemo(() => allHeldBackChanges(data.repositories), [data]);
  const terms = changeTerms(data.repositories[0]?.platform);
  // Only offer other views when names have a path to hide or nest.
  const nested = [...open, ...heldBack].some((c) => c.repo.name.includes("/"));
  const [view, setView] = useRepoView(nested);
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const shownOpen = useMemo(() => (needle ? open.filter((c) => matches(c, needle)) : open), [open, needle]);
  const shownHeldBack = useMemo(
    () => (needle ? heldBack.filter((c) => matches(c, needle)) : heldBack),
    [heldBack, needle],
  );
  const openColumns = useMemo(
    () => (types: string[]) => changeColumns(terms.short, types, data.platformUrl),
    [terms.short, data.platformUrl],
  );
  const heldBackCols = useMemo(() => (types: string[]) => heldBackColumns(terms.short, types), [terms.short]);
  const repos = new Set(open.map((c) => c.repo.name)).size;
  const updates = open.reduce((n, c) => n + c.branch.upgrades.length, 0);

  return (
    <>
      <h1>Open {terms.long}s</h1>
      <p class="muted">Renovate {terms.long}s that are open, across all repositories.</p>
      {open.length + heldBack.length === 0 ? (
        <EmptyState>
          No open Renovate {terms.long}s. Renovate leaves them out of the report when run with{" "}
          <code>--dry-run=lookup</code>.
        </EmptyState>
      ) : (
        <>
          <div class="stats">
            <Stat label={`Open ${terms.short}s`} value={open.length} />
            <Stat label="Repositories" value={repos} />
            <Stat label="Updates" value={updates} />
            {heldBack.length > 0 && <Stat label="Held back by limits" value={heldBack.length} />}
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
          {open.length > 0 ? (
            <ChangeTable changes={shownOpen} perChange={openColumns} term={terms.short} data={data} view={view} />
          ) : (
            <EmptyState>No open Renovate {terms.long}s.</EmptyState>
          )}
          {heldBack.length > 0 && (
            <section id="held-back">
              <h2>Held back by limits</h2>
              <p class="muted">
                Renovate has these {terms.long}s ready but has not opened them, because it reached one of its limits.
                They open on a later run once there is room. Hover a limit to see the setting behind it.
              </p>
              <ChangeTable
                changes={shownHeldBack}
                perChange={heldBackCols}
                term={terms.short}
                data={data}
                view={view}
              />
            </section>
          )}
        </>
      )}
    </>
  );
}
