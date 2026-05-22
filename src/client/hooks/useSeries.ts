import { useEffect, useState } from "react";

export interface SeriesPoint {
  ts: number;
  count: number;
}

export function useSeries(short: string, refreshKey: number): SeriesPoint[] {
  const [series, setSeries] = useState<SeriesPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const r = await fetch(
          `/api/agg/series?short=${encodeURIComponent(short)}&window=1h&bucket=1m`,
        );
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
  }, [short, refreshKey]);

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
): BreakdownRow[] {
  const [rows, setRows] = useState<BreakdownRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const r = await fetch(
          `/api/agg/breakdown?short=${encodeURIComponent(short)}&dim=${dim}&limit=5`,
        );
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
  }, [short, dim, refreshKey]);

  return rows;
}
