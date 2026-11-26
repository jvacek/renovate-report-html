import { useState } from "preact/hooks";
import type { Branch, Dep, Repository } from "../../report/data.ts";
import { allDeps, packageId } from "../../report/stats.ts";
import {
  Age,
  type Column,
  CurrentVersion,
  orderUpdateTypes,
  ProblemList,
  plural,
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

const branchColumns: Column<Branch>[] = [
  {
    label: "Branch",
    sort: (b) => b.branchName,
    render: (b) => <code>{b.branchName}</code>,
  },
  { label: "PR title", sort: (b) => b.prTitle, render: (b) => b.prTitle },
  {
    label: "PR",
    class: "num",
    sort: (b) => b.prNo ?? undefined,
    render: (b) => (b.prNo ? `#${b.prNo}` : ""),
  },
  {
    label: "Result",
    sort: (b) => b.result,
    render: (b) => b.result && <span class="badge">{b.result}</span>,
  },
  {
    label: "Upgrades",
    render: (b) => (
      <span class="badges">
        {orderUpdateTypes(b.upgrades.map((u) => u.updateType ?? "unknown")).map((type) => (
          <UpdateBadge key={type} type={type} />
        ))}{" "}
        {plural(b.upgrades.length, "upgrade")}
      </span>
    ),
  },
];

function matches(dep: Dep, filter: string, onlyUpdates: boolean): boolean {
  if (onlyUpdates && dep.updates.length === 0) return false;
  if (!filter) return true;
  const needle = filter.toLowerCase();
  return [dep.name, dep.packageName, dep.depType, dep.datasource].some((v) => v?.toLowerCase().includes(needle));
}

export function RepoView({ repo }: { repo: Repository }) {
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
      <h1>{repo.name}</h1>
      {meta.some(Boolean) && <p class="muted">{meta.filter(Boolean).join(" · ")}</p>}
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

      <section>
        <h2>Branches</h2>
        {repo.branches.length === 0 ? (
          <p class="muted">
            No branch data. Renovate leaves this empty when run with <code>--dry-run=lookup</code>, or when no branches
            are needed.
          </p>
        ) : (
          <details>
            <summary>{plural(repo.branches.length, "branch", "branches")} Renovate would create or update</summary>
            <SortableTable
              columns={branchColumns}
              rows={repo.branches}
              rowKey={(b) => b.branchName}
              initialSort={{ column: 0, desc: false }}
            />
          </details>
        )}
      </section>
    </>
  );
}

/** In-page jump that leaves the hash route alone. */
function scrollToId(event: Event, id: string) {
  event.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}
