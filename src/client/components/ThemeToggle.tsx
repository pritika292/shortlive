import { useTheme, type ThemePreference } from "../hooks/useTheme.js";

const ORDER: ThemePreference[] = ["light", "system", "dark"];
const LABELS: Record<ThemePreference, string> = {
  light: "Light",
  system: "System",
  dark: "Dark",
};
const ICONS: Record<ThemePreference, string> = {
  light: "☼",
  system: "🖥",
  dark: "☾",
};

export function ThemeToggle(): JSX.Element {
  const { preference, setPreference } = useTheme();
  return (
    <div className="flex items-center rounded-full border border-slate-700 bg-slate-900/60 p-0.5 text-xs">
      {ORDER.map((p) => {
        const active = p === preference;
        return (
          <button
            key={p}
            type="button"
            aria-pressed={active}
            aria-label={`Use ${LABELS[p].toLowerCase()} theme`}
            onClick={() => setPreference(p)}
            className={
              "px-2 py-0.5 rounded-full transition-colors " +
              (active ? "bg-slate-700 text-slate-100" : "text-slate-400 hover:text-slate-100")
            }
          >
            <span aria-hidden>{ICONS[p]}</span>
            <span className="sr-only">{LABELS[p]}</span>
          </button>
        );
      })}
    </div>
  );
}
