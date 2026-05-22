import { useEffect, useRef, useState } from "react";
import type { SeriesPoint, BreakdownRow, SeriesFilters } from "./useSeries.js";

export interface DashboardSnapshot {
  series: SeriesPoint[];
  // Total clicks matching the active filter set. Drives the LiveCounter so
  // toggling a filter updates the count immediately instead of leaving the
  // unfiltered WS-tracked total in place.
  total: number;
  breakdowns: {
    country: BreakdownRow[];
    device: BreakdownRow[];
    referrer: BreakdownRow[];
  };
}

const EMPTY: DashboardSnapshot = {
  series: [],
  total: 0,
  breakdowns: { country: [], device: [], referrer: [] },
};

// 150ms is long enough to coalesce a normal click-multiple-chips-in-a-row
// pattern but short enough that intentional single toggles still feel snappy.
const DEBOUNCE_MS = 150;

// Cache TTL of 30s. Refresh keys (10s tick from Dashboard) will naturally bust
// the cache without us having to do anything else.
const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  data: DashboardSnapshot;
  ts: number;
}
const cache = new Map<string, CacheEntry>();

function buildQuery(short: string, filters?: SeriesFilters, limit = 20): string {
  const params = new URLSearchParams({ short });
  const window = filters?.window ?? "1h";
  params.set("window", window);
  params.set("bucket", window === "24h" ? "15m" : window === "6h" ? "5m" : "1m");
  params.set("dims", "country,device,referrer");
  params.set("limit", String(limit));
  if (filters?.countries && filters.countries.length > 0) {
    params.set("country", filters.countries.join(","));
  }
  if (filters?.devices && filters.devices.length > 0) {
    params.set("device", filters.devices.join(","));
  }
  return params.toString();
}

interface SnapshotResponse {
  series: SeriesPoint[];
  total?: number;
  breakdowns: Record<string, { total: number; rows: BreakdownRow[] }>;
}

export function useDashboardSnapshot(
  short: string,
  refreshKey: number,
  filters?: SeriesFilters,
  limit = 20,
): DashboardSnapshot {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(EMPTY);
  const filterKey = JSON.stringify(filters ?? {});

  // Track the latest in-flight controller so we can abort it on the next
  // filter change. Prevents a stale earlier response from clobbering a
  // fresher one.
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const cacheKey = `${short}|${refreshKey}|${limit}|${filterKey}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setSnapshot(cached.data);
      return;
    }

    // Debounce: defer the actual fetch by DEBOUNCE_MS so rapid filter toggles
    // collapse into one request.
    const timer = setTimeout(() => {
      // Abort any in-flight request from a previous filter state.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const load = async (): Promise<void> => {
        try {
          const qs = buildQuery(short, filters, limit);
          const r = await fetch(`/api/agg/snapshot?${qs}`, { signal: controller.signal });
          if (!r.ok) return;
          const j = (await r.json()) as SnapshotResponse;
          const data: DashboardSnapshot = {
            series: j.series,
            total: j.total ?? 0,
            breakdowns: {
              country: j.breakdowns.country?.rows ?? [],
              device: j.breakdowns.device?.rows ?? [],
              referrer: j.breakdowns.referrer?.rows ?? [],
            },
          };
          cache.set(cacheKey, { data, ts: Date.now() });
          // Only commit if this controller is still the latest in-flight one
          // (defensive: abort should have prevented this already).
          if (!controller.signal.aborted) setSnapshot(data);
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
          // Other failures: swallow; the next refreshKey tick will retry.
        }
      };
      void load();
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [short, refreshKey, filterKey, limit]);

  return snapshot;
}

// Exposed for tests to verify the cache invalidates correctly.
export function _clearSnapshotCache(): void {
  cache.clear();
}
