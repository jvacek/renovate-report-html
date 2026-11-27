import type { ComponentChildren } from "preact";
import { useMemo, useRef, useState } from "preact/hooks";
import { describeLimit, type HeldBackChange, type OpenChange, upgradesByType } from "../report/changes.ts";
import type { Branch, Dep, Payload, Problem, ReportData, Repository, Update } from "../report/data.ts";
import { tokenizeJson } from "../report/json-tokens.ts";
import { hasIconSlot, platformLinks, repoIcon, splitRepoName } from "../report/platform.ts";
import { staleness, updateTypeOf } from "../report/stats.ts";
import { href } from "./router.ts";

export function formatAge(days: number): string {
  if (days < 60) return `${days} d`;
  if (days < 730) return `${Math.round(days / 30.44)} mo`;
  return `${(days / 365.25).toFixed(1)} y`;
}

export function Age({ days, timestamp }: { days?: number; timestamp?: string }) {
  if (days === undefined) return <span class="empty">n/a</span>;
  const title = timestamp ? `Released ${timestamp.slice(0, 10)} (${days} days ago)` : `${days} days old`;
  return (
    <span class={`age age-${staleness(days)}`} title={title}>
      {formatAge(days)}
    </span>
  );
}

/** A number for a table cell, muted when it shows zero or is missing, so the values that matter stand out. */
export function Count({ value, format = String }: { value?: number; format?: (value: number) => string }) {
  if (value === undefined) return <span class="empty">n/a</span>;
  const text = format(value);
  return Number(text) === 0 ? <span class="empty">{text}</span> : <>{text}</>;
}

const shortDigest = (digest: string) => digest.replace(/^sha256:/, "").slice(0, 7);

/** A dep's name; unnamed ones show the text Renovate found in the file instead. */
export function DepName({ dep }: { dep: Dep }) {
  return dep.unnamed ? (
    <code title="Renovate could not name this reference, usually because it contains a variable. This is the text found in the file.">
      {dep.name}
    </code>
  ) : (
    <>{dep.name}</>
  );
}

/** "×18" when the file lists the same dep several times. */
export function Occurrences({ dep }: { dep: Dep }) {
  if (!dep.occurrences) return null;
  return (
    <span class="badge occurrences" title={`Listed ${dep.occurrences} times in this file, all identical`}>
      ×{dep.occurrences}
    </span>
  );
}

export function CurrentVersion({ dep }: { dep: Dep }) {
  const version = dep.currentVersion ?? dep.lockedVersion;
  const value = dep.currentValue;
  return (
    <span class="version">
      {value ?? version ?? <span class="empty">none</span>}
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
            {(Object.keys(problem.context).length > 0 || problem.payloads.length > 0) && (
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
                {problem.payloads.map((payload) => (
                  <div key={payload.key}>
                    <dt>{payload.key}</dt>
                    <dd class="payload">
                      <PayloadButton payload={payload} />
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

/** A one-line summary of a JSON payload that opens the full, pretty-printed JSON in a modal. */
function PayloadButton({ payload }: { payload: Payload }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const tokens = useMemo(() => (open ? tokenizeJson(payload.json) : []), [open, payload.json]);
  const copy = () =>
    navigator.clipboard.writeText(payload.json).then(
      () => setCopied(true),
      () => {},
    );
  return (
    <>
      <button
        type="button"
        class="payload-open"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        <code class="payload-summary">{payload.summary}</code>
        <span class="payload-hint">Show JSON</span>
      </button>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the click closes on the backdrop; keyboards have Escape. */}
      <dialog
        ref={dialog}
        class="payload-dialog"
        aria-label={payload.key}
        // A click on the dialog element itself, not its content, is a click on the backdrop.
        onClick={(event) => event.target === event.currentTarget && event.currentTarget.close()}
        onClose={() => {
          setOpen(false);
          setCopied(false);
        }}
      >
        <header>
          <code>{payload.key}</code>
          <button type="button" class="button" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" class="button" onClick={() => dialog.current?.close()}>
            Close
          </button>
        </header>
        <pre>
          {tokens.map((token, i) =>
            token.kind ? (
              <span key={i} class={`json-${token.kind}`}>
                {token.text}
              </span>
            ) : (
              token.text
            ),
          )}
        </pre>
      </dialog>
    </>
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

/**
 * Horizontal bars for a set of counts, largest first unless `order` is given.
 * Keys in `always` get a bar even when they have no count, so the set looks complete.
 */
export function BarList({
  counts: given,
  order,
  always = [],
  classFor,
  label = (key) => key,
}: {
  counts: Record<string, number>;
  order?: string[];
  always?: string[];
  classFor?: (key: string) => string;
  label?: (key: string) => ComponentChildren;
}) {
  const counts = { ...Object.fromEntries(always.map((key) => [key, 0])), ...given };
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
            {counts[key] ? (
              <span class={`bar ${classFor?.(key) ?? ""}`} style={{ width: `${(counts[key] / max) * 100}%` }} />
            ) : null}
          </span>
          <span class="bar-count">
            <Count value={counts[key]} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface Column<T> {
  label: string;
  /** Tooltip on the header. */
  title?: string;
  render: (row: T) => ComponentChildren;
  /** Value to sort by. Columns without one are not sortable. Missing values sort last. */
  sort?: (row: T) => string | number | undefined;
  /** Sort descending on first click, for counts and ages. */
  descFirst?: boolean;
  class?: string;
}

const collator = new Intl.Collator(undefined, { numeric: true });

interface ShownRow<T> {
  row: T;
  key: string;
  depth: number;
  /** Set on rows with children: whether they are showing. */
  expanded?: boolean;
}

/**
 * With `childrenOf`, rows form a tree: children sort among themselves under their parent, and
 * rows with children get a toggle in the first column that collapses them.
 */
export function SortableTable<T>({
  columns,
  rows,
  rowKey,
  childrenOf,
  initialSort,
  empty = "Nothing to show.",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  childrenOf?: (row: T) => T[] | undefined;
  initialSort?: { column: number; desc: boolean };
  empty?: string;
}) {
  const [sort, setSort] = useState(initialSort);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const shown = useMemo(() => {
    const by = sort && columns[sort.column]?.sort;
    const dir = sort?.desc ? -1 : 1;
    const out: ShownRow<T>[] = [];
    const walk = (list: T[], depth: number, parentKey: string) => {
      // Keys get the original index appended, since rows such as deps can repeat.
      const keyed = list.map((row, i) => ({ row, key: `${parentKey}${rowKey(row)}#${i}` }));
      if (by) {
        keyed.sort(({ row: a }, { row: b }) => {
          const x = by(a);
          const y = by(b);
          if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? 1 : -1;
          if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
          return collator.compare(String(x), String(y)) * dir;
        });
      }
      for (const { row, key } of keyed) {
        const children = childrenOf?.(row);
        const expanded = children && !collapsed.has(rowKey(row));
        out.push({ row, key, depth, expanded });
        if (children && expanded) walk(children, depth + 1, `${key}/`);
      }
    };
    walk(rows, 0, "");
    return out;
  }, [rows, columns, sort, rowKey, childrenOf, collapsed]);

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

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
                <th key={column.label} scope="col" class={column.class} aria-sort={ariaSort} title={column.title}>
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
                      <span class="sort-arrow" aria-hidden="true">
                        {active ? (sort.desc ? "▼" : "▲") : ""}
                      </span>
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
          {shown.map(({ row, key, depth, expanded }) => (
            <tr key={key} class={expanded === undefined ? undefined : "tree-parent"}>
              {columns.map((column, i) => (
                <td key={column.label} class={column.class}>
                  {childrenOf && i === 0 ? (
                    <span class="tree-cell" style={{ "--depth": depth }}>
                      {expanded === undefined ? (
                        <span class="tree-leaf">{column.render(row)}</span>
                      ) : (
                        <button
                          type="button"
                          class="tree-toggle"
                          aria-expanded={expanded}
                          onClick={() => toggle(rowKey(row))}
                        >
                          {column.render(row)}
                        </button>
                      )}
                    </span>
                  ) : (
                    column.render(row)
                  )}
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
 * The colour says the type; UpdateTypesLegend explains it.
 */
export function UpdateCounts({ counts, types }: { counts: Record<string, number>; types: string[] }) {
  return (
    <span class="update-counts">
      {types.map((type) => (
        <span key={type} class="update-count">
          {counts[type] ? (
            <span class={`update-chip count type-${type}`} title={`${counts[type]} ${type}`}>
              {counts[type]}
            </span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

export function UpdateTypesLegend({ types }: { types: string[] }) {
  return (
    <p class="legend muted">
      Updates by type:{" "}
      {types.map((type) => (
        <span key={type} class={`update-type type-${type}`}>
          {type}
        </span>
      ))}
    </p>
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

export interface RowChanges<T> {
  open: (row: T) => OpenChange[];
  heldBack: (row: T) => HeldBackChange[];
  /** "PR" or "MR". */
  term: string;
  platformUrl?: string;
}

/**
 * The changes that touch each row: open ones as links, then held back ones as a badge naming the
 * limit. Sorts by the first open one's number.
 */
export function changesColumn<T>(label: string, changes: RowChanges<T>): Column<T> {
  return {
    label,
    descFirst: true,
    sort: (r) => changes.open(r)[0]?.branch.prNo,
    render: (r) => (
      <span class="badges">
        {changes.open(r).map((change, i) => (
          <span key={change.branch.branchName}>
            {i > 0 && ", "}
            <ChangeLink change={change} platformUrl={changes.platformUrl} />
          </span>
        ))}
        {changes.heldBack(r).map((change) => (
          <LimitBadge key={change.branch.branchName} change={change} term={changes.term} />
        ))}
      </span>
    ),
  };
}

/** "branch limit" and the like: why Renovate has not opened a PR for this change yet. */
export function LimitBadge({ change, term }: { change: HeldBackChange; term: string }) {
  const { label, title } = describeLimit(change.limit, term);
  const what = change.branch.prTitle ? `${change.branch.prTitle}: not opened yet. ` : "Not opened yet. ";
  return (
    <span class="badge held-back" title={`${what}${title}`}>
      {label}
    </span>
  );
}

/**
 * Columns for a table of changes a limit held back: title, limit, updates and branch.
 * `updateTypes` are the slots of the Updates column (see `changeUpdateTypes`).
 */
export function heldBackColumns(
  term: string,
  updateTypes: string[],
): [
  title: Column<HeldBackChange>,
  limit: Column<HeldBackChange>,
  updates: Column<HeldBackChange>,
  branch: Column<HeldBackChange>,
] {
  return [
    { label: "Title", sort: (c) => c.branch.prTitle, render: (c) => c.branch.prTitle },
    {
      label: "Held back by",
      sort: (c) => describeLimit(c.limit, term).label,
      render: (c) => <LimitBadge change={c} term={term} />,
    },
    updatesColumn(updateTypes),
    branchColumn(),
  ];
}

function updatesColumn<T extends { branch: Branch }>(updateTypes: string[]): Column<T> {
  return {
    label: "Updates",
    title: `Updates by type, in this order: ${updateTypes.join(", ")}. Sorts by the total.`,
    descFirst: true,
    sort: (c) => c.branch.upgrades.length,
    render: (c) => <UpdateCounts counts={upgradesByType(c.branch)} types={updateTypes} />,
  };
}

function branchColumn<T extends { branch: Branch }>(): Column<T> {
  return {
    label: "Branch",
    sort: (c) => c.branch.branchName,
    render: (c) => (
      <>
        <code>{c.branch.branchName}</code>
        {c.branch.baseBranch && <span class="muted"> into {c.branch.baseBranch}</span>}
      </>
    ),
  };
}

/** The update types that occur in `changes`, in order: one slot each in the Updates column. */
export function changeUpdateTypes(changes: { branch: Branch }[]): string[] {
  return orderUpdateTypes(changes.flatMap((c) => c.branch.upgrades.map((u) => u.updateType ?? "unknown")));
}

/** "#12", linked to the pull or merge request when we know the code host. */
export function ChangeLink({ change, platformUrl }: { change: OpenChange; platformUrl?: string }) {
  const { prNo, prTitle } = change.branch;
  const links = platformLinks(change.repo, platformUrl);
  if (!links) return <span title={prTitle}>#{prNo}</span>;
  return (
    <a href={links.change(prNo)} title={prTitle} target="_blank" rel="noreferrer">
      #{prNo}
    </a>
  );
}

/**
 * Columns for a table of one repository's open changes: number, title, updates and branch.
 * `updateTypes` are the slots of the Updates column (see `changeUpdateTypes`).
 */
export function changeColumns(
  term: string,
  updateTypes: string[],
  platformUrl?: string,
): [number: Column<OpenChange>, title: Column<OpenChange>, updates: Column<OpenChange>, branch: Column<OpenChange>] {
  return [
    {
      label: term,
      class: "num",
      descFirst: true,
      sort: (c) => c.branch.prNo,
      render: (c) => <ChangeLink change={c} platformUrl={platformUrl} />,
    },
    { label: "Title", sort: (c) => c.branch.prTitle, render: (c) => c.branch.prTitle },
    updatesColumn(updateTypes),
    branchColumn(),
  ];
}

/**
 * "group/sub/" in muted text so the project name itself stands out. Keeps the full name as one
 * string for find-in-page. With `hidePath`, only the project name shows; the path is in its tooltip.
 */
export function RepoName({ name, hidePath }: { name: string; hidePath?: boolean }) {
  const parts = splitRepoName(name);
  if (hidePath) return <span title={name}>{parts.name}</span>;
  return (
    <>
      {parts.path && <span class="repo-path">{parts.path}</span>}
      {parts.name}
    </>
  );
}

/**
 * The project's icon, embedded or hotlinked (see `repoIcon`). Under it sits a letter tile, like
 * the code host's own fallback, which shows when there is no icon or the image can't load
 * (offline, or a private project the browser isn't signed in to).
 */
export function RepoAvatar({ url, name }: { url?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span class="repo-avatar" aria-hidden="true">
      {splitRepoName(name).name.charAt(0).toUpperCase()}
      {url && !failed && (
        <img src={url} alt="" loading="lazy" referrerpolicy="no-referrer" onError={() => setFailed(true)} />
      )}
    </span>
  );
}

const reposByName = new WeakMap<Repository[], Map<string, Repository>>();

function findRepo(report: ReportData, name: string): Repository | undefined {
  let byName = reposByName.get(report.repositories);
  if (!byName) {
    byName = new Map(report.repositories.map((repo) => [repo.name, repo]));
    reposByName.set(report.repositories, byName);
  }
  return byName.get(name);
}

/** A link to a repository's page, with its icon when the report gives repositories an icon slot. */
export function RepoLink({ name, report, hidePath }: { name: string; report: ReportData; hidePath?: boolean }) {
  const repo = findRepo(report, name) ?? { name };
  const link = (
    <a href={href.repo(name)}>
      <RepoName name={name} hidePath={hidePath} />
    </a>
  );
  return hasIconSlot(repo, report) ? (
    <span class="with-icon">
      <RepoAvatar url={repoIcon(repo, report)} name={name} />
      {link}
    </span>
  ) : (
    link
  );
}

const RepoItems = ({ repos, report }: { repos: string[]; report: ReportData }) => (
  <ul>
    {repos.map((repo) => (
      <li key={repo}>
        <RepoLink name={repo} report={report} />
      </li>
    ))}
  </ul>
);

/**
 * Repository links, one per line. Past `limit`, the rest sit in a <details>, which keeps
 * them reachable by find-in-page while collapsed.
 */
export function RepoList({ repos, report, limit = 5 }: { repos: string[]; report: ReportData; limit?: number }) {
  const sorted = repos.toSorted((a, b) => a.localeCompare(b));
  const rest = sorted.slice(limit);
  return (
    <div class="repo-list">
      <RepoItems repos={sorted.slice(0, limit)} report={report} />
      {rest.length > 0 && (
        <details>
          <summary>Show {rest.length} more</summary>
          <RepoItems repos={rest} report={report} />
        </details>
      )}
    </div>
  );
}
