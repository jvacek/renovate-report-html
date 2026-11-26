/**
 * Project icons supplied as files: `<dir>/<repository path>.<ext>`, such as
 * `icons/group/sub/app.webp`. How they got there (downloaded, resized, drawn) is up to the user.
 * The CLI embeds them as data URLs, so the page shows them without asking the code host.
 */
import type { ReportData } from "./data.ts";

/** Icons bigger than this get a warning: they bloat the page, and resizing them first is cheap. */
export const LARGE_ICON_BYTES = 50 * 1024;

/** Decided from the first bytes, not the extension: GitLab serves avatars without a useful type. */
export function imageType(bytes: Uint8Array): string | undefined {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45) return "image/webp";
  if (starts(0x00, 0x00, 0x01, 0x00)) return "image/x-icon";
  if (starts(0x42, 0x4d)) return "image/bmp";
  return undefined;
}

/**
 * Pick the icon file for each repository from paths relative to the icons directory, using `/`.
 * The extension is ignored, so `group/app.png` and `group/app.webp` both match `group/app`.
 */
export function matchIconFiles(files: string[], repoNames: string[]): Map<string, string> {
  const byStem = new Map<string, string>();
  for (const file of files.toSorted()) {
    const stem = file.replace(/\.[^./]+$/, "");
    if (!byStem.has(stem)) byStem.set(stem, file);
  }
  const matches = new Map<string, string>();
  for (const name of repoNames) {
    const file = byStem.get(name);
    if (file) matches.set(name, file);
  }
  return matches;
}

export interface IconResult {
  data: ReportData;
  embedded: number;
  warnings: string[];
}

/** `read` returns the bytes of a file from `matchIconFiles`. Repositories without one keep the letter tile. */
export async function embedIcons(
  data: ReportData,
  files: string[],
  read: (file: string) => Promise<Uint8Array>,
): Promise<IconResult> {
  const matches = matchIconFiles(
    files,
    data.repositories.map((r) => r.name),
  );
  const warnings: string[] = [];
  const icons = new Map<string, string>();
  for (const [name, file] of matches) {
    const bytes = await read(file);
    const type = imageType(bytes);
    if (!type) {
      warnings.push(`${file} is not a PNG, JPEG, GIF, WebP, ICO or BMP image, skipped.`);
      continue;
    }
    if (bytes.length > LARGE_ICON_BYTES) {
      warnings.push(`${file} is ${Math.round(bytes.length / 1024)} KB. Resizing icons to 64 px keeps the page small.`);
    }
    icons.set(name, `data:${type};base64,${Buffer.from(bytes).toString("base64")}`);
  }
  return {
    data: {
      ...data,
      embeddedIcons: true,
      repositories: data.repositories.map((repo) => {
        const icon = icons.get(repo.name);
        return icon ? { ...repo, icon } : repo;
      }),
    },
    embedded: icons.size,
    warnings,
  };
}
