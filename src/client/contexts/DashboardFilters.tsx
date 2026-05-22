import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { continentOf, type ContinentCode } from "../lib/continents.js";

// Single-select on purpose: one continent OR one country at a time, never a
// combination. Toggling the same chip again clears the filter; tapping a
// different chip replaces it.
export type ActiveFilter =
  | { kind: "continent"; code: ContinentCode }
  | { kind: "country"; code: string }
  | null;

export interface DashboardFiltersValue {
  active: ActiveFilter;
  // Convenience accessors for the existing chip components.
  countries: Set<string>;
  continents: Set<ContinentCode>;
  toggleCountry: (country: string) => void;
  toggleContinent: (continent: ContinentCode) => void;
  clearAll: () => void;
  // Predicate: does this event's country fall within the active filter? Used
  // by the client-side demo simulator and the analytics dashboard alike.
  matches: (country: string | null) => boolean;
  hasFilter: boolean;
  // For the server-backed analytics path: the explicit list of countries to
  // pass to /api/agg/snapshot. Empty Set means no filter.
  effectiveCountries: Set<string>;
  // For URL serialization: returns a query-string fragment representing the
  // active filter, or empty string when none.
  toQuery: () => string;
}

const Ctx = createContext<DashboardFiltersValue | null>(null);

interface Props {
  children: ReactNode;
  // The dashboard passes the country list it knows about (top breakdown rows)
  // so the continent → countries expansion uses the right set. Optional; if
  // not supplied, the continent filter expands by walking the static
  // CURATED_COUNTRIES list via continentOf.
  knownCountries?: string[];
}

export function DashboardFiltersProvider({ children, knownCountries }: Props): JSX.Element {
  const [active, setActive] = useState<ActiveFilter>(null);

  const toggleCountry = useCallback((country: string) => {
    setActive((prev) =>
      prev?.kind === "country" && prev.code === country ? null : { kind: "country", code: country },
    );
  }, []);

  const toggleContinent = useCallback((continent: ContinentCode) => {
    setActive((prev) =>
      prev?.kind === "continent" && prev.code === continent
        ? null
        : { kind: "continent", code: continent },
    );
  }, []);

  const clearAll = useCallback(() => setActive(null), []);

  const value = useMemo<DashboardFiltersValue>(() => {
    const countries = new Set<string>();
    const continents = new Set<ContinentCode>();
    if (active?.kind === "country") countries.add(active.code);
    if (active?.kind === "continent") continents.add(active.code);

    const effective = new Set<string>();
    if (active?.kind === "country") {
      effective.add(active.code);
    } else if (active?.kind === "continent") {
      for (const c of knownCountries ?? []) {
        if (continentOf(c) === active.code) effective.add(c);
      }
    }

    const matches = (country: string | null): boolean => {
      if (!active) return true;
      if (!country) return false;
      if (active.kind === "country") return country === active.code;
      return continentOf(country) === active.code;
    };

    const params = new URLSearchParams();
    if (effective.size > 0) params.set("country", [...effective].sort().join(","));

    return {
      active,
      countries,
      continents,
      toggleCountry,
      toggleContinent,
      clearAll,
      matches,
      hasFilter: active !== null,
      effectiveCountries: effective,
      toQuery: () => params.toString(),
    };
  }, [active, toggleCountry, toggleContinent, clearAll, knownCountries]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboardFilters(): DashboardFiltersValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDashboardFilters must be used inside DashboardFiltersProvider");
  return v;
}

export { continentOf };
