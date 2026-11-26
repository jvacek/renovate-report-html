import ICONS from "virtual:datasource-icons";

/** Near-black brand colours (GitHub, Rust) would vanish in dark mode; use the text colour for those. */
function fill(hex: string): string {
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.12 ? "currentColor" : `#${hex}`;
}

/** Fallback for datasources without a brand: a plain package box. */
const PACKAGE_PATH =
  "M12 1.5 2.5 6.75v10.5L12 22.5l9.5-5.25V6.75L12 1.5Zm0 2.3 6.9 3.8L12 11.4 5.1 7.6 12 3.8ZM4.5 9.3l6.5 3.6v7.2l-6.5-3.6V9.3Zm8.5 10.8v-7.2l6.5-3.6v7.2L13 20.1Z";

export function DatasourceIcon({ datasource }: { datasource?: string }) {
  const icon = datasource ? ICONS[datasource] : undefined;
  return (
    <svg class="ds-icon" viewBox="0 0 24 24" role="img" aria-label={datasource ?? "unknown datasource"}>
      <title>{datasource ?? "unknown datasource"}</title>
      <path d={icon?.path ?? PACKAGE_PATH} fill={icon ? fill(icon.hex) : "currentColor"} opacity={icon ? 1 : 0.45} />
    </svg>
  );
}
