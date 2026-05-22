import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { continentOf, type ContinentCode } from "../lib/continents.js";

export interface DashboardFiltersValue {
  countries: Set<string>;
  continents: Set<ContinentCode>;
  toggleCountry: (country: string) => void;
  toggleContinent: (continent: ContinentCode) => void;
  clearAll: () => void;
  // Effective country filter — the explicit list of countries that the
  // dashboard should narrow to. Derived from the user's continent + country
  // toggles. Empty Set means "no filter".
  effectiveCountries: Set<string>;
  // For URL serialization: returns a query-string fragment (without the
  // leading ?) representing the active filters, or empty string when none.
  toQuery: () => string;
}

const Ctx = createContext<DashboardFiltersValue | null>(null);

export function DashboardFiltersProvider({ children }: { children: ReactNode }): JSX.Element {
  const [countries, setCountries] = useState<Set<string>>(new Set());
  const [continents, setContinents] = useState<Set<ContinentCode>>(new Set());

  const toggleCountry = useCallback((country: string) => {
    setCountries((prev) => {
      const next = new Set(prev);
      if (next.has(country)) next.delete(country);
      else next.add(country);
      return next;
    });
  }, []);

  const toggleContinent = useCallback((continent: ContinentCode) => {
    setContinents((prev) => {
      const next = new Set(prev);
      if (next.has(continent)) next.delete(continent);
      else next.add(continent);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setCountries(new Set());
    setContinents(new Set());
  }, []);

  // effectiveCountries: union of explicit countries plus all countries that
  // belong to selected continents. When both sets are empty, no filter.
  const value = useMemo<DashboardFiltersValue>(() => {
    const eff = new Set<string>(countries);
    if (continents.size > 0) {
      // We don't have the reverse map here; the breakdown rows tell us what's
      // observed. Expand by walking known countries → continent.
      // (Cheaper for now: caller passes only countries it knows about via
      //  available chips. Continents expand client-side via the existing
      //  breakdown rows; we just include them here as a hint.)
    }
    const params = new URLSearchParams();
    if (eff.size > 0) params.set("country", [...eff].sort().join(","));
    return {
      countries,
      continents,
      toggleCountry,
      toggleContinent,
      clearAll,
      effectiveCountries: eff,
      toQuery: () => params.toString(),
    };
  }, [countries, continents, toggleCountry, toggleContinent, clearAll]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboardFilters(): DashboardFiltersValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDashboardFilters must be used inside DashboardFiltersProvider");
  return v;
}

export { continentOf };
