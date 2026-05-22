import { CONTINENT_LABEL, type ContinentCode } from "../lib/continents.js";
import { useDashboardFilters } from "../contexts/DashboardFilters.js";

const ORDER: ContinentCode[] = ["NA", "EU", "AS", "SA", "AF", "OC"];

export function ContinentFilter(): JSX.Element {
  const { continents, toggleContinent } = useDashboardFilters();
  return (
    <div className="flex flex-wrap gap-2">
      {ORDER.map((c) => {
        const active = continents.has(c);
        return (
          <button
            key={c}
            type="button"
            onClick={() => toggleContinent(c)}
            className={
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all " +
              (active
                ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30 border border-transparent"
                : "border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-400 dark:hover:border-white/20")
            }
          >
            {CONTINENT_LABEL[c]}
          </button>
        );
      })}
    </div>
  );
}
