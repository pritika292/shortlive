import { useEffect, useState } from "react";

export interface SeriesPoint {
  ts: number;
  count: number;
}

export interface SeriesFilters {
  countries?: string[];
  devices?: string[];
  window?: "15m" | "1h" | "6h" | "24h";
}

function buildQuery(
  short: string,
  filters?: SeriesFilters,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams({ short });
  if (filters?.window) params.set("window", filters.window);
  if (filters?.countries && filters.countries.length > 0) {
    params.set("country", filters.countries.join(","));
  }
  if (filters?.devices && filters.devices.length > 0) {
    params.set("device", filters.devices.join(","));
  }
  for (const [k, v] of Object.entries(extra ?? {})) params.set(k, v);
  return params.toString();
}

export function useSeries(
  short: string,
  refreshKey: number,
  filters?: SeriesFilters,
): SeriesPoint[] {
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  // Stringify filters into the dependency to keep the effect honest.
  const filterKey = JSON.stringify(filters ?? {});

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const qs = buildQuery(short, filters, {
          window: filters?.window ?? "1h",
          bucket: filters?.window === "24h" ? "15m" : filters?.window === "6h" ? "5m" : "1m",
        });
        const r = await fetch(`/api/agg/series?${qs}`);
        if (!r.ok) return;
        const j = (await r.json()) as { series: SeriesPoint[] };
        if (!cancelled) setSeries(j.series);
      } catch {
        // ignore
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [short, refreshKey, filterKey]);

  return series;
}

export interface BreakdownRow {
  value: string;
  count: number;
  percent: number;
}

export function useBreakdown(
  short: string,
  dim: "country" | "device" | "referrer",
  refreshKey: number,
  filters?: SeriesFilters,
  limit = 5,
): BreakdownRow[] {
  const [rows, setRows] = useState<BreakdownRow[]>([]);
  const filterKey = JSON.stringify(filters ?? {});

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const qs = buildQuery(short, filters, { dim, limit: String(limit) });
        const r = await fetch(`/api/agg/breakdown?${qs}`);
        if (!r.ok) return;
        const j = (await r.json()) as { rows: BreakdownRow[] };
        if (!cancelled) setRows(j.rows);
      } catch {
        // ignore
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [short, dim, refreshKey, filterKey, limit]);

  return rows;
}
