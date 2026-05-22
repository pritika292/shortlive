import { CURATED_COUNTRIES } from "../lib/continents.js";
import { useDashboardFilters } from "../contexts/DashboardFilters.js";

export function CountryChipFilter(): JSX.Element {
  const { countries, toggleCountry } = useDashboardFilters();
  return (
    <div className="flex flex-wrap gap-2">
      {CURATED_COUNTRIES.map((c) => {
        const active = countries.has(c.code);
        return (
          <button
            key={c.code}
            type="button"
            onClick={() => toggleCountry(c.code)}
            title={c.name}
            className={
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all " +
              (active
                ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30 border border-transparent"
                : "border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-400 dark:hover:border-white/20")
            }
          >
            <span aria-hidden className="text-base leading-none">
              {c.flag}
            </span>
            <span>{c.code}</span>
          </button>
        );
      })}
    </div>
  );
}
