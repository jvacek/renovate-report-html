import { useMemo, useState } from "preact/hooks";
import { hasOpenChanges, openChanges } from "../../report/changes.ts";
import type { ReportData, Repository } from "../../report/data.ts";
import { buildFolderTree, type Folder } from "../../report/groups.ts";
import { changeTerms, splitRepoName } from "../../report/platform.ts";
import { allDeps, updateTypeOf } from "../../report/stats.ts";
import {
  Age,
  ageInfo,
  type Column,
  ColumnPicker,
  Count,
  libYearsInfo,
  orderUpdateTypes,
  ProblemCount,
  RepoLink,
  SortableTable,
  UpdateCounts,
  updateTypesInfo,
  useHiddenColumns,
} from "../components.tsx";
import { GroupCell, type RepoView, RepoViewToggle, useRepoView } from "../repo-view.tsx";

/** One repository, or a group folder with the totals of every repository below it. */
interface RepoRow {
  /** The repository name, or the group path for folders. */
  key: string;
  /** What the Repository column shows and sorts by. */
  label: string;
  repo?: Repository;
  folder?: { path: string; children: RepoRow[]; first: Repository };
  problems: number;
  deps: number;
  outdated: number;
  skippedByReason: Record<string, number>;
  skipped: number;
  updatesByType: Record<string, number>;
  updates: number;
  openChanges: number;
  oldestAge?: number;
  libYears?: number;
}

type Stats = Omit<RepoRow, "key" | "label" | "repo" | "folder">;

function statsOf(repos: Repository[]): Stats {
  const libYears = repos.flatMap((repo) => (repo.libYears === undefined ? [] : [repo.libYears]));
  const row: Stats = {
    problems: repos.reduce((sum, repo) => sum + repo.problems.length, 0),
    deps: 0,
    outdated: 0,
    skippedByReason: {},
    skipped: 0,
    updatesByType: {},
    updates: 0,
    openChanges: repos.reduce((sum, repo) => sum + openChanges(repo).length, 0),
    libYears: libYears.length ? libYears.reduce((a, b) => a + b, 0) : undefined,
  };
  for (const { dep } of allDeps(repos)) {
    row.deps++;
    if (dep.updates.length > 0) row.outdated++;
    if (dep.skipReason) {
      row.skipped++;
      row.skippedByReason[dep.skipReason] = (row.skippedByReason[dep.skipReason] ?? 0) + 1;
    }
    for (const update of dep.updates) {
      const type = updateTypeOf(update);
      row.updatesByType[type] = (row.updatesByType[type] ?? 0) + 1;
      row.updates++;
    }
    const age = dep.currentVersionAgeInDays;
    if (age !== undefined && (row.oldestAge === undefined || age > row.oldestAge)) row.oldestAge = age;
  }
  return row;
}

function repoRow(repo: Repository, label: string): RepoRow {
  return { key: repo.name, label, repo, ...statsOf([repo]) };
}

function folderRows(folder: Folder<Repository>): RepoRow[] {
  const repos = (f: Folder<Repository>): Repository[] => [...f.items, ...f.folders.flatMap(repos)];
  return [
    ...folder.folders.map((sub): RepoRow => {
      const all = repos(sub);
      return {
        key: sub.path,
        label: sub.label,
        folder: { path: sub.path, children: folderRows(sub), first: all[0] as Repository },
        ...statsOf(all),
      };
    }),
    ...folder.items.map((repo) => repoRow(repo, splitRepoName(repo.name).name)),
  ];
}

function rowsFor(repos: Repository[], view: RepoView): RepoRow[] {
  if (view === "folders") return folderRows(buildFolderTree(repos, (repo) => repo.name));
  return repos.map((repo) => repoRow(repo, view === "names" ? splitRepoName(repo.name).name : repo.name));
}

const childrenOf = (row: RepoRow) => row.folder?.children;

function RepoCell({ row, data, hidePath }: { row: RepoRow; data: ReportData; hidePath: boolean }) {
  const { repo, folder } = row;
  const name = folder ? (
    <GroupCell path={folder.path} label={row.label} first={folder.first} data={data} />
  ) : repo ? (
    <RepoLink name={repo.name} report={data} hidePath={hidePath} />
  ) : null;
  return (
    <span class="with-problems">
      {name}
      <ProblemCount count={row.problems} after />
    </span>
  );
}

/** `changesLabel` is unset when no repository has an open change, which hides the column. */
function columnsFor(updateTypes: string[], data: ReportData, view: RepoView, changesLabel?: string): Column<RepoRow>[] {
  const changes: Column<RepoRow>[] = changesLabel
    ? [
        {
          label: changesLabel,
          class: "num",
          descFirst: true,
          sort: (r) => r.openChanges,
          render: (r) => <Count value={r.openChanges} />,
        },
      ]
    : [];
  return [
    {
      label: "Repository",
      sort: (r) => r.label,
      render: (r) => <RepoCell row={r} data={data} hidePath={view !== "paths"} />,
    },
    { label: "Deps", class: "num", descFirst: true, sort: (r) => r.deps, render: (r) => <Count value={r.deps} /> },
    {
      label: "Outdated",
      class: "num",
      descFirst: true,
      sort: (r) => r.outdated,
      render: (r) => <Count value={r.outdated} />,
    },
    {
      label: "Skipped",
      class: "num",
      descFirst: true,
      sort: (r) => r.skipped,
      render: (r) => (
        <span
          title={Object.entries(r.skippedByReason)
            .sort((a, b) => b[1] - a[1])
            .map(([reason, n]) => `${reason}: ${n}`)
            .join("\n")}
        >
          <Count value={r.skipped} />
        </span>
      ),
    },
    {
      label: "Updates",
      info: updateTypesInfo("Available updates"),
      descFirst: true,
      sort: (r) => r.updates,
      render: (r) => <UpdateCounts counts={r.updatesByType} types={updateTypes} />,
    },
    ...changes,
    {
      label: "Oldest",
      info: ageInfo,
      class: "num",
      descFirst: true,
      sort: (r) => r.oldestAge,
      render: (r) => <Age days={r.oldestAge} />,
    },
    {
      label: "Libyears",
      info: libYearsInfo,
      class: "num",
      descFirst: true,
      sort: (r) => r.libYears,
      render: (r) => <Count value={r.libYears} format={(years) => years.toFixed(1)} />,
    },
  ];
}

const rowKey = (row: RepoRow) => row.key;

export function ReposView({ data }: { data: ReportData }) {
  const { repositories } = data;
  const [filter, setFilter] = useState("");
  // Only offer other views when names have a path to hide or nest.
  const nested = repositories.some((repo) => repo.name.includes("/"));
  const [activeView, setView] = useRepoView(nested);
  // One slot per update type that occurs anywhere, so counts line up across rows.
  const updateTypes = useMemo(() => orderUpdateTypes(Object.keys(statsOf(repositories).updatesByType)), [repositories]);
  const columns = useMemo(
    () =>
      columnsFor(
        updateTypes,
        data,
        activeView,
        // A column of zeros says nothing, so it only shows when some repository has an open change.
        hasOpenChanges(repositories) ? `Open ${changeTerms(repositories[0]?.platform).short}s` : undefined,
      ),
    [updateTypes, repositories, data, activeView],
  );
  const [hidden, setHidden] = useHiddenColumns("repos");
  const shownColumns = useMemo(() => columns.filter((c) => !hidden.includes(c.label)), [columns, hidden]);
  const needle = filter.trim().toLowerCase();
  const matching = useMemo(
    () => (needle ? repositories.filter((repo) => repo.name.toLowerCase().includes(needle)) : repositories),
    [repositories, needle],
  );
  const rows = useMemo(() => rowsFor(matching, activeView), [matching, activeView]);

  return (
    <>
      <h1>Repositories</h1>
      <div class="toolbar">
        <input
          type="search"
          placeholder="Filter repositories"
          value={filter}
          onInput={(e) => setFilter(e.currentTarget.value)}
          aria-label="Filter repositories"
        />
        <span class="muted">
          {matching.length} of {repositories.length}
        </span>
        <div class="toolbar-end">
          {nested && <RepoViewToggle view={activeView} onChange={setView} />}
          <ColumnPicker columns={columns.slice(1)} hidden={hidden} onChange={setHidden} />
        </div>
      </div>
      <SortableTable
        columns={shownColumns}
        rows={rows}
        rowKey={rowKey}
        childrenOf={activeView === "folders" ? childrenOf : undefined}
        initialSort={{ column: 0, desc: false }}
        empty={repositories.length ? "No repositories match this filter." : "The report has no repositories."}
      />
    </>
  );
}
