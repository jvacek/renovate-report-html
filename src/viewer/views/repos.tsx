import { useMemo, useState } from "preact/hooks";
import { hasBranchData, openChanges } from "../../report/changes.ts";
import type { ReportData, Repository } from "../../report/data.ts";
import { buildFolderTree, type Folder } from "../../report/groups.ts";
import { changeTerms, groupIcon, hasIconSlot, repoIcon, splitRepoName } from "../../report/platform.ts";
import { allDeps, updateTypeOf } from "../../report/stats.ts";
import {
  Age,
  type Column,
  orderUpdateTypes,
  RepoAvatar,
  RepoName,
  SortableTable,
  StalenessLegend,
  UpdateCounts,
} from "../components.tsx";
import { href } from "../router.ts";

/** How repository names show: the full path, the project name alone, or nested in group folders. */
type RepoView = "paths" | "names" | "folders";

const VIEWS: { value: RepoView; label: string }[] = [
  { value: "paths", label: "Full paths" },
  { value: "names", label: "Names" },
  { value: "folders", label: "Folders" },
];

const VIEW_KEY = "renovate-report-html:repos-view";

function readView(): RepoView {
  try {
    const value = localStorage.getItem(VIEW_KEY);
    return VIEWS.find((view) => view.value === value)?.value ?? "folders";
  } catch {
    return "folders";
  }
}

function useRepoView(): [RepoView, (view: RepoView) => void] {
  const [view, setView] = useState(readView);
  const choose = (next: RepoView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Site data blocked: the choice still applies to this page view.
    }
  };
  return [view, choose];
}

/** One repository, or a group folder with the totals of every repository below it. */
interface RepoRow {
  /** The repository name, or the group path for folders. */
  key: string;
  /** What the Repository column shows and sorts by. */
  label: string;
  repo?: Repository;
  folder?: { path: string; children: RepoRow[]; first: Repository };
  problems: number;
  managers: number;
  deps: number;
  outdated: number;
  updatesByType: Record<string, number>;
  updates: number;
  openChanges: number;
  medianAge?: number;
  oldestAge?: number;
  libYears?: number;
}

type Stats = Omit<RepoRow, "key" | "label" | "repo" | "folder">;

function statsOf(repos: Repository[]): Stats {
  const libYears = repos.flatMap((repo) => (repo.libYears === undefined ? [] : [repo.libYears]));
  const row: Stats = {
    problems: repos.reduce((sum, repo) => sum + repo.problems.length, 0),
    managers: new Set(repos.flatMap((repo) => repo.managers.map((m) => m.name))).size,
    deps: 0,
    outdated: 0,
    updatesByType: {},
    updates: 0,
    openChanges: repos.reduce((sum, repo) => sum + openChanges(repo).length, 0),
    libYears: libYears.length ? libYears.reduce((a, b) => a + b, 0) : undefined,
  };
  const ages: number[] = [];
  for (const { dep } of allDeps(repos)) {
    row.deps++;
    if (dep.updates.length > 0) row.outdated++;
    for (const update of dep.updates) {
      const type = updateTypeOf(update);
      row.updatesByType[type] = (row.updatesByType[type] ?? 0) + 1;
      row.updates++;
    }
    if (dep.currentVersionAgeInDays !== undefined) ages.push(dep.currentVersionAgeInDays);
  }
  ages.sort((a, b) => a - b);
  row.medianAge = ages[Math.floor(ages.length / 2)];
  row.oldestAge = ages.at(-1);
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
  if (folder) {
    const platform = folder.first.platform;
    return hasIconSlot(folder.first, data) ? (
      <span class="with-icon">
        <RepoAvatar url={groupIcon(folder.path, platform, data)} name={folder.path} />
        <span title={folder.path}>{row.label}</span>
      </span>
    ) : (
      <span title={folder.path}>{row.label}</span>
    );
  }
  if (!repo) return null;
  const link = (
    <a href={href.repo(repo.name)}>
      <RepoName name={repo.name} hidePath={hidePath} />
    </a>
  );
  return hasIconSlot(repo, data) ? (
    <span class="with-icon">
      <RepoAvatar url={repoIcon(repo, data)} name={repo.name} />
      {link}
    </span>
  ) : (
    link
  );
}

/** `changesLabel` is unset when the report has no branch data, which hides the column. */
function columnsFor(updateTypes: string[], data: ReportData, view: RepoView, changesLabel?: string): Column<RepoRow>[] {
  const changes: Column<RepoRow>[] = changesLabel
    ? [
        {
          label: changesLabel,
          class: "num",
          descFirst: true,
          sort: (r) => r.openChanges,
          render: (r) => r.openChanges || "",
        },
      ]
    : [];
  return [
    {
      label: "Repository",
      sort: (r) => r.label,
      render: (r) => <RepoCell row={r} data={data} hidePath={view !== "paths"} />,
    },
    {
      label: "Problems",
      class: "num",
      descFirst: true,
      sort: (r) => r.problems,
      render: (r) => (r.problems ? <span class="badge level-warn">{r.problems}</span> : ""),
    },
    { label: "Managers", class: "num", descFirst: true, sort: (r) => r.managers, render: (r) => r.managers },
    { label: "Deps", class: "num", descFirst: true, sort: (r) => r.deps, render: (r) => r.deps },
    { label: "Outdated", class: "num", descFirst: true, sort: (r) => r.outdated, render: (r) => r.outdated },
    {
      label: "Updates",
      descFirst: true,
      sort: (r) => r.updates,
      render: (r) => <UpdateCounts counts={r.updatesByType} types={updateTypes} />,
    },
    ...changes,
    {
      label: "Median age",
      class: "num",
      descFirst: true,
      sort: (r) => r.medianAge,
      render: (r) => <Age days={r.medianAge} />,
    },
    {
      label: "Oldest",
      class: "num",
      descFirst: true,
      sort: (r) => r.oldestAge,
      render: (r) => <Age days={r.oldestAge} />,
    },
    {
      label: "Libyears",
      class: "num",
      descFirst: true,
      sort: (r) => r.libYears,
      render: (r) => (r.libYears === undefined ? "" : r.libYears.toFixed(1)),
    },
  ];
}

const rowKey = (row: RepoRow) => row.key;

export function ReposView({ data }: { data: ReportData }) {
  const { repositories } = data;
  const [filter, setFilter] = useState("");
  const [view, setView] = useRepoView();
  // Only offer other views when names have a path to hide or nest.
  const nested = repositories.some((repo) => repo.name.includes("/"));
  const activeView = nested ? view : "paths";
  // One slot per update type that occurs anywhere, so chips line up across rows.
  const columns = useMemo(
    () =>
      columnsFor(
        orderUpdateTypes(Object.keys(statsOf(repositories).updatesByType)),
        data,
        activeView,
        hasBranchData(repositories) ? `Open ${changeTerms(repositories[0]?.platform).short}s` : undefined,
      ),
    [repositories, data, activeView],
  );
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
        {nested && (
          <fieldset class="segmented" aria-label="Show repositories as">
            {VIEWS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={activeView === option.value}
                onClick={() => setView(option.value)}
              >
                {option.label}
              </button>
            ))}
          </fieldset>
        )}
      </div>
      <StalenessLegend />
      <SortableTable
        columns={columns}
        rows={rows}
        rowKey={rowKey}
        childrenOf={activeView === "folders" ? childrenOf : undefined}
        initialSort={{ column: 0, desc: false }}
        empty={repositories.length ? "No repositories match this filter." : "The report has no repositories."}
      />
    </>
  );
}
