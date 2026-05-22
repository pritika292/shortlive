import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "shortlive:theme";
const DEFAULT_THEME: ThemePreference = "dark";

function readPreference(): ThemePreference {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" ? "light" : "dark";
}

function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function useTheme(): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
} {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readPreference());

  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference): void => {
    setPreferenceState(p);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, p);
    }
  }, []);

  return { preference, resolved: preference, setPreference };
}
