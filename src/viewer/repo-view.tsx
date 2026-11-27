/** How tables show repository names, shared by every page with a Repository column. */
import { useState } from "preact/hooks";
import type { ReportData, Repository } from "../report/data.ts";
import { groupIcon, hasIconSlot } from "../report/platform.ts";
import { RepoAvatar } from "./components.tsx";

/** The full path, the project name alone, or nested in group folders. */
export type RepoView = "paths" | "names" | "folders";

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

/**
 * The chosen view, remembered across pages and visits. Names without a path have nothing to
 * hide or nest, so `nested` false always gives "paths".
 */
export function useRepoView(nested: boolean): [RepoView, (view: RepoView) => void] {
  const [view, setView] = useState(readView);
  const choose = (next: RepoView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Site data blocked: the choice still applies to this page view.
    }
  };
  return [nested ? view : "paths", choose];
}

export function RepoViewToggle({ view, onChange }: { view: RepoView; onChange: (view: RepoView) => void }) {
  return (
    <fieldset class="segmented" aria-label="Show repositories as">
      {VIEWS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={view === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

/** A group folder row's name, with the group's icon when repositories get an icon slot. */
export function GroupCell({
  path,
  label,
  first,
  data,
}: {
  path: string;
  label: string;
  /** Any repository in the group, for the platform. */
  first: Repository;
  data: ReportData;
}) {
  const name = <span title={path}>{label}</span>;
  return hasIconSlot(first, data) ? (
    <span class="with-icon">
      <RepoAvatar url={groupIcon(path, first.platform, data)} name={path} />
      {name}
    </span>
  ) : (
    name
  );
}
