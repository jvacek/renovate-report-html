import type { ComponentChildren } from "preact";
import { type Theme, useSystemIsDark, useTheme } from "./theme.ts";

export function ThemeSwitcher() {
  const [theme, setTheme] = useTheme();
  const systemIsDark = useSystemIsDark();
  const options: { value: Theme; label: string; icon: ComponentChildren }[] = [
    {
      value: "system",
      label: `System theme (currently ${systemIsDark ? "dark" : "light"})`,
      // A monitor whose screen is filled when the system is dark.
      icon: (
        <>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
          {systemIsDark ? (
            <rect x="5.5" y="6.5" width="13" height="7" rx="0.5" fill="currentColor" stroke="none" />
          ) : null}
        </>
      ),
    },
    {
      value: "light",
      label: "Light theme",
      icon: (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </>
      ),
    },
    {
      value: "dark",
      label: "Dark theme",
      icon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
    },
  ];

  return (
    <fieldset class="theme-switcher" aria-label="Theme">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.label}
          aria-label={option.label}
          aria-pressed={theme === option.value}
          onClick={() => setTheme(option.value)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {option.icon}
          </svg>
        </button>
      ))}
    </fieldset>
  );
}
