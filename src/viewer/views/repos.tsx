import { useMemo, useState } from "preact/hooks";
import { hasBranchData, openChanges } from "../../report/changes.ts";
import type { Repository } from "../../report/data.ts";
import { changeTerms, platformLinks } from "../../report/platform.ts";
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

interface RepoRow {
  repo: Repository;
  managers: number;
  deps: number;
  outdated: number;
  updatesByType: Record<string, number>;
  updates: number;
  openChanges: number;
  medianAge?: number;
  oldestAge?: number;
}

function repoRow(repo: Repository): RepoRow {
  const row: RepoRow = {
    repo,
    managers: repo.managers.length,
    deps: 0,
    outdated: 0,
    updatesByType: {},
    updates: 0,
    openChanges: openChanges(repo).length,
  };
  const ages: number[] = [];
  for (const { dep } of allDeps([repo])) {
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

/** `changesLabel` is unset when the report has no branch data, which hides the column. */
function columnsFor(updateTypes: string[], changesLabel?: string, platformUrl?: string): Column<RepoRow>[] {
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
      sort: (r) => r.repo.name,
      render: (r) => {
        const avatar = platformLinks(r.repo, platformUrl)?.avatar;
        const link = (
          <a href={href.repo(r.repo.name)}>
            <RepoName name={r.repo.name} />
          </a>
        );
        return avatar ? (
          <span class="with-icon">
            <RepoAvatar url={avatar} name={r.repo.name} />
            {link}
          </span>
        ) : (
          link
        );
      },
    },
    {
      label: "Problems",
      class: "num",
      descFirst: true,
      sort: (r) => r.repo.problems.length,
      render: (r) => (r.repo.problems.length ? <span class="badge level-warn">{r.repo.problems.length}</span> : ""),
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
      sort: (r) => r.repo.libYears,
      render: (r) => (r.repo.libYears === undefined ? "" : r.repo.libYears.toFixed(1)),
    },
  ];
}

export function ReposView({ repositories, platformUrl }: { repositories: Repository[]; platformUrl?: string }) {
  const [filter, setFilter] = useState("");
  const rows = useMemo(() => repositories.map(repoRow), [repositories]);
  // One slot per update type that occurs anywhere, so chips line up across rows.
  const columns = useMemo(
    () =>
      columnsFor(
        orderUpdateTypes(rows.flatMap((r) => Object.keys(r.updatesByType))),
        hasBranchData(repositories) ? `Open ${changeTerms(repositories[0]?.platform).short}s` : undefined,
        platformUrl,
      ),
    [rows, repositories, platformUrl],
  );
  const needle = filter.trim().toLowerCase();
  const shown = needle ? rows.filter((r) => r.repo.name.toLowerCase().includes(needle)) : rows;

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
          {shown.length} of {rows.length}
        </span>
      </div>
      <StalenessLegend />
      <SortableTable
        columns={columns}
        rows={shown}
        rowKey={(r) => r.repo.name}
        initialSort={{ column: 0, desc: false }}
        empty={rows.length ? "No repositories match this filter." : "The report has no repositories."}
      />
    </>
  );
}
