/**
 * The groups repositories sit in: GitLab groups and subgroups, or GitHub owners.
 */

/** "a/b/c" -> ["a", "a/b"]: every group a repository sits in, outermost first. */
export function parentPaths(name: string): string[] {
  const parts = name.split("/").slice(0, -1);
  return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
}

/** Every group path the repositories sit in, without duplicates. */
export function groupPaths(names: string[]): string[] {
  return [...new Set(names.flatMap(parentPaths))];
}
