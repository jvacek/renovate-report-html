/**
 * Repository paths as a folder tree: GitLab groups and subgroups, or GitHub owners.
 */

export interface Folder<T> {
  /** Full group path, such as "group/sub". Empty for the root. */
  path: string;
  /** What the row shows: the path below the parent folder, such as "sub" or "sub/deeper". */
  label: string;
  folders: Folder<T>[];
  items: T[];
}

/** "a/b/c" -> ["a", "a/b"]: every group a repository sits in, outermost first. */
export function parentPaths(name: string): string[] {
  const parts = name.split("/").slice(0, -1);
  return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
}

/** Every group path the repositories sit in, without duplicates. */
export function groupPaths(names: string[]): string[] {
  return [...new Set(names.flatMap(parentPaths))];
}

/**
 * Nest items by their repository path. A folder that holds nothing but one subfolder merges
 * into it ("a" + "a/b" becomes "a/b"), so long chains of single subgroups take one row.
 */
export function buildFolderTree<T>(items: T[], nameOf: (item: T) => string): Folder<T> {
  const root: Folder<T> = { path: "", label: "", folders: [], items: [] };
  const byPath = new Map<string, Folder<T>>([["", root]]);
  const folderAt = (path: string): Folder<T> => {
    let folder = byPath.get(path);
    if (!folder) {
      const cut = path.lastIndexOf("/");
      folder = { path, label: path.slice(cut + 1), folders: [], items: [] };
      byPath.set(path, folder);
      folderAt(cut === -1 ? "" : path.slice(0, cut)).folders.push(folder);
    }
    return folder;
  };
  for (const item of items) {
    const name = nameOf(item);
    folderAt(name.slice(0, Math.max(0, name.lastIndexOf("/")))).items.push(item);
  }
  return compact(root);
}

function compact<T>(folder: Folder<T>): Folder<T> {
  const folders = folder.folders.map((child) => {
    let merged = child;
    while (merged.items.length === 0 && merged.folders.length === 1) {
      const [only] = merged.folders as [Folder<T>];
      merged = { ...only, label: `${merged.label}/${only.label}` };
    }
    return compact(merged);
  });
  return { ...folder, folders };
}
