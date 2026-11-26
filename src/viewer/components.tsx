import type { ComponentChildren } from "preact";
import { useMemo, useState } from "preact/hooks";
import type { Dep, Problem, Update } from "../report/data.ts";
import { staleness, updateTypeOf } from "../report/stats.ts";
import { href } from "./router.ts";

export function formatAge(days: number): string {
  if (days < 60) return `${days} d`;
  if (days < 730) return `${Math.round(days / 30.44)} mo`;
  return `${(days / 365.25).toFixed(1)} y`;
}

export function Age({ days, timestamp }: { days?: number; timestamp?: string }) {
  if (days === undefined) return <span class="muted">n/a</span>;
  const title = timestamp ? `Released ${timestamp.slice(0, 10)} (${days} days ago)` : `${days} days old`;
  return (
    <span class={`age age-${staleness(days)}`} title={title}>
      {formatAge(days)}
    </span>
  );
}

const shortDigest = (digest: string) => digest.replace(/^sha256:/, "").slice(0, 7);

export function CurrentVersion({ dep }: { dep: Dep }) {
  const version = dep.currentVersion ?? dep.lockedVersion;
  const value = dep.currentValue;
  return (
    <span class="version">
      {value ?? version ?? <span class="muted">none</span>}
      {value && version && version !== value && <span class="muted"> ({version})</span>}
      {dep.currentDigest && <span class="muted digest"> @{shortDigest(dep.currentDigest)}</span>}
    </span>
  );
}

export function UpdateBadge({ type }: { type: string }) {
  return <span class={`badge type-${type}`}>{type}</span>;
}

export function Updates({ updates }: { updates: Update[] }) {
  if (updates.length === 0) return null;
  return (
    <ul class="updates">
      {updates.map((update) => (
        <li key={`${update.updateType}-${update.newVersion}-${update.newDigest}`}>
          <UpdateBadge type={updateTypeOf(update)} />{" "}
          <span class="version">
            {update.newValue ?? update.newVersion ?? (update.newDigest && `@${shortDigest(update.newDigest)}`)}
          </span>
          {update.isBreaking && <span class="badge breaking">breaking</span>}
        </li>
      ))}
    </ul>
  );
}

const LEVELS: [number, string][] = [
  [60, "fatal"],
  [50, "error"],
  [40, "warn"],
  [30, "info"],
];

export function levelName(level?: number): string {
  if (level === undefined) return "unknown";
  return LEVELS.find(([min]) => level >= min)?.[1] ?? "debug";
}

const isUrl = (text: string) => /^https?:\/\//.test(text);

export function ProblemList({ problems }: { problems: Problem[] }) {
  return (
    <ul class="problems">
      {problems.map((problem, i) => {
        const level = levelName(problem.level);
        return (
          <li key={i} class={`problem level-${level}`}>
            <div class="problem-head">
              <span class={`badge level-${level}`}>{level}</span>
            </div>
            <p class="problem-msg">{problem.message}</p>
            {Object.keys(problem.context).length > 0 && (
              <dl class="problem-context">
                {Object.entries(problem.context).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>
                      {isUrl(value) ? (
                        <a href={value} target="_blank" rel="noreferrer">
                          {value}
                        </a>
                      ) : (
                        <code>{value}</code>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ComponentChildren; tone?: string }) {
  return (
    <div class={`stat ${tone ? `tone-${tone}` : ""}`}>
      <div class="stat-value">{value}</div>
      <div class="stat-label">{label}</div>
    </div>
  );
}

/** Horizontal bars for a set of counts, largest first unless `order` is given. */
export function BarList({
  counts,
  order,
  classFor,
  label = (key) => key,
}: {
  counts: Record<string, number>;
  order?: string[];
  classFor?: (key: string) => string;
  label?: (key: string) => ComponentChildren;
}) {
  const known = order?.filter((key) => key in counts) ?? [];
  const rest = Object.keys(counts)
    .filter((key) => !known.includes(key))
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0));
  const keys = [...known, ...rest];
  const max = Math.max(1, ...Object.values(counts));
  if (keys.length === 0) return <p class="muted">None.</p>;
  return (
    <ul class="bars">
      {keys.map((key) => (
        <li key={key}>
          <span class="bar-label">{label(key)}</span>
          <span class="bar-track">
            <span class={`bar ${classFor?.(key) ?? ""}`} style={{ width: `${((counts[key] ?? 0) / max) * 100}%` }} />
          </span>
          <span class="bar-count">{counts[key]}</span>
        </li>
      ))}
    </ul>
  );
}

export interface Column<T> {
  label: string;
  render: (row: T) => ComponentChildren;
  /** Value to sort by. Columns without one are not sortable. Missing values sort last. */
  sort?: (row: T) => string | number | undefined;
  /** Sort descending on first click, for counts and ages. */
  descFirst?: boolean;
  class?: string;
}

export function SortableTable<T>({
  columns,
  rows,
  rowKey,
  initialSort,
  empty = "Nothing to show.",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  initialSort?: { column: number; desc: boolean };
  empty?: string;
}) {
  const [sort, setSort] = useState(initialSort);
  // Keys get the original index appended, since rows such as deps can repeat.
  const sorted = useMemo(() => {
    const keyed = rows.map((row, i) => ({ row, key: `${rowKey(row)}#${i}` }));
    const by = sort && columns[sort.column]?.sort;
    if (!sort || !by) return keyed;
    const dir = sort.desc ? -1 : 1;
    return keyed.sort(({ row: a }, { row: b }) => {
      const x = by(a);
      const y = by(b);
      if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? 1 : -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x).localeCompare(String(y), undefined, { numeric: true }) * dir;
    });
  }, [rows, columns, sort, rowKey]);

  if (rows.length === 0) return <p class="muted">{empty}</p>;
  return (
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column, i) => {
              const active = sort?.column === i;
              const ariaSort = active ? (sort.desc ? "descending" : "ascending") : undefined;
              return (
                <th key={column.label} class={column.class} aria-sort={ariaSort}>
                  {column.sort ? (
                    <button
                      type="button"
                      class="sort"
                      onClick={() =>
                        setSort({
                          column: i,
                          desc: active ? !sort.desc : Boolean(column.descFirst),
                        })
                      }
                    >
                      {column.label}
                      <span class="sort-arrow">{active ? (sort.desc ? "▼" : "▲") : ""}</span>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ row, key }) => (
            <tr key={key}>
              {columns.map((column) => (
                <td key={column.label} class={column.class}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StalenessLegend() {
  return (
    <p class="legend muted">
      Age of the version in use: <span class="age age-fresh">under 3 mo</span>{" "}
      <span class="age age-aging">under 1 y</span> <span class="age age-stale">under 2 y</span>{" "}
      <span class="age age-ancient">2 y or more</span>
    </p>
  );
}

/** Order in which update types are listed, roughly by risk. */
export const UPDATE_TYPE_ORDER = [
  "major",
  "minor",
  "patch",
  "digest",
  "pin",
  "pinDigest",
  "lockFileMaintenance",
  "bump",
  "replacement",
  "rollback",
];

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Sort update types by UPDATE_TYPE_ORDER, unknown types last. */
export function orderUpdateTypes(types: string[]): string[] {
  const rank = (type: string) => {
    const i = UPDATE_TYPE_ORDER.indexOf(type);
    return i === -1 ? UPDATE_TYPE_ORDER.length : i;
  };
  return [...new Set(types)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * Update counts in fixed slots, one per type in `types`, so the same type lines
 * up across table rows even when a row lacks it or counts have more digits.
 */
export function UpdateCounts({ counts, types }: { counts: Record<string, number>; types: string[] }) {
  return (
    <span class="update-counts">
      {types.map((type) => (
        <span key={type} class="update-count">
          {counts[type] ? (
            <>
              <UpdateBadge type={type} /> <span class="count">{counts[type]}</span>
            </>
          ) : null}
        </span>
      ))}
    </span>
  );
}

export function ExternalButton({
  href,
  children,
  primary,
}: {
  href: string;
  children: ComponentChildren;
  primary?: boolean;
}) {
  return (
    <a class={`button ${primary ? "button-primary" : ""}`} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

const RepoItems = ({ repos }: { repos: string[] }) => (
  <ul>
    {repos.map((repo) => (
      <li key={repo}>
        <a href={href.repo(repo)}>{repo}</a>
      </li>
    ))}
  </ul>
);

/**
 * Bulleted repository links. Past `limit`, the rest sit in a <details>, which keeps
 * them reachable by find-in-page while collapsed.
 */
export function RepoList({ repos, limit = 5 }: { repos: string[]; limit?: number }) {
  const sorted = [...repos].sort((a, b) => a.localeCompare(b));
  const rest = sorted.slice(limit);
  return (
    <div class="repo-list">
      <RepoItems repos={sorted.slice(0, limit)} />
      {rest.length > 0 && (
        <details>
          <summary>Show {rest.length} more</summary>
          <RepoItems repos={rest} />
        </details>
      )}
    </div>
  );
}
