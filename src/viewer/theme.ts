import { useEffect, useState } from "preact/hooks";

/**
 * "system" stores nothing and follows the OS. The inline script in index.html applies the stored
 * value before first paint and must use the same key and values.
 */
export type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "renovate-report-html:color-scheme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readStored(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

/** The stylesheet maps this meta tag to `color-scheme`, which drives every `light-dark()` colour. */
function apply(theme: Theme) {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) meta.content = theme === "system" ? "light dark" : theme;
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState(readStored);

  // Another tab (or another report opened from disk, which shares storage) changed it.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const next = readStored();
      apply(next);
      setTheme(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const choose = (next: Theme) => {
    apply(next);
    setTheme(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Site data blocked: the choice still applies to this page view.
    }
  };
  return [theme, choose];
}

/** What "system" currently resolves to, kept live as the OS setting changes. */
export function useSystemIsDark(): boolean {
  const [dark, setDark] = useState(() => matchMedia(DARK_QUERY).matches);
  useEffect(() => {
    const query = matchMedia(DARK_QUERY);
    const onChange = () => setDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return dark;
}
