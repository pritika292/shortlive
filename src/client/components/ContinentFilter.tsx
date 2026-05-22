import { CONTINENT_LABEL, type ContinentCode } from "../lib/continents.js";
import { useDashboardFilters } from "../contexts/DashboardFilters.js";

const ORDER: ContinentCode[] = ["NA", "EU", "AS", "SA", "AF", "OC", "AN"];

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
              "px-3 py-1 rounded-full text-xs transition-colors " +
              (active
                ? "bg-sky-600 text-white dark:bg-sky-500 dark:text-slate-950 border border-transparent"
                : "border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800")
            }
          >
            {CONTINENT_LABEL[c]}
          </button>
        );
      })}
    </div>
  );
}
