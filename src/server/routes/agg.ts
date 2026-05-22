import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db/pool.js";

export const aggRouter: Router = Router();

const SHORT_RE = /^[0-9A-Za-z-]{3,32}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const DEVICE_VALUES = new Set(["desktop", "mobile", "tablet"]);
const DIM_VALUES = new Set(["country", "device", "referrer"]);

type Dim = "country" | "device" | "referrer";

function parseCsv(value: unknown, validator: (s: string) => boolean): string[] | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const parts = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  for (const p of parts) {
    if (!validator(p)) return null;
  }
  return parts;
}

const WINDOW_MS: Record<string, number> = {
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "6h": 6 * 60 * 60_000,
  "24h": 24 * 60 * 60_000,
};

const BUCKET_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
};

interface SeriesPoint {
  ts: number;
  count: number;
}

interface BreakdownRow {
  value: string;
  count: number;
  percent: number;
}

interface BreakdownResult {
  total: number;
  rows: BreakdownRow[];
}

interface FilterParts {
  filters: string[];
  params: unknown[];
}

function buildClickFilters(
  short: string,
  countries: string[] | null,
  devices: string[] | null,
  extra: unknown[] = [],
): FilterParts {
  const params: unknown[] = [short, ...extra];
  const filters: string[] = [];
  if (countries) {
    params.push(countries);
    filters.push(`AND country = ANY($${params.length}::text[])`);
  }
  if (devices) {
    params.push(devices);
    filters.push(`AND device = ANY($${params.length}::text[])`);
  }
  return { filters, params };
}

async function runSeries(
  short: string,
  window: keyof typeof WINDOW_MS,
  bucket: keyof typeof BUCKET_SECONDS,
  countries: string[] | null,
  devices: string[] | null,
): Promise<{ series: SeriesPoint[]; bucketSeconds: number }> {
  const since = new Date(Date.now() - (WINDOW_MS[window] ?? 60 * 60_000));
  const bucketSec = BUCKET_SECONDS[bucket] ?? 60;
  const { filters, params } = buildClickFilters(short, countries, devices, [since, bucketSec]);
  const { rows } = await getPool().query<{ ts: Date; count: string }>(
    `SELECT to_timestamp(floor(extract(epoch FROM ts) / $3) * $3) AS ts,
            COUNT(*)::text AS count
       FROM clicks
      WHERE url_id = (SELECT id FROM urls WHERE short = $1)
        AND ts >= $2
        ${filters.join(" ")}
      GROUP BY 1
      ORDER BY 1`,
    params,
  );
  return {
    series: rows.map((r) => ({ ts: r.ts.getTime(), count: Number(r.count) })),
    bucketSeconds: bucketSec,
  };
}

async function runTotal(
  short: string,
  countries: string[] | null,
  devices: string[] | null,
): Promise<number> {
  const { filters, params } = buildClickFilters(short, countries, devices);
  const { rows } = await getPool().query<{ c: string }>(
    `SELECT COUNT(*)::text AS c
       FROM clicks
      WHERE url_id = (SELECT id FROM urls WHERE short = $1)
        ${filters.join(" ")}`,
    params,
  );
  return Number(rows[0]?.c ?? 0);
}

async function runBreakdown(
  short: string,
  dim: Dim,
  limit: number,
  countries: string[] | null,
  devices: string[] | null,
): Promise<BreakdownResult> {
  const { filters, params } = buildClickFilters(short, countries, devices);
  params.push(limit);
  const limitIdx = params.length;

  // Exclude NULL values from the breakdown. A "(unknown)" bucket dominating
  // the chart looks like a data-quality bug to anyone visiting the page.
  const { rows } = await getPool().query<{ value: string; count: string; total: string }>(
    `WITH base AS (
       SELECT ${dim} AS value
         FROM clicks
        WHERE url_id = (SELECT id FROM urls WHERE short = $1)
          AND ${dim} IS NOT NULL
          ${filters.join(" ")}
     ),
     totals AS (SELECT COUNT(*)::text AS total FROM base)
     SELECT value, COUNT(*)::text AS count, totals.total
       FROM base, totals
      GROUP BY value, totals.total
      ORDER BY COUNT(*) DESC
      LIMIT $${limitIdx}`,
    params,
  );
  const total = rows[0] ? Number(rows[0].total) : 0;
  return {
    total,
    rows: rows.map((r) => ({
      value: r.value,
      count: Number(r.count),
      percent: total > 0 ? Number(((Number(r.count) / total) * 100).toFixed(1)) : 0,
    })),
  };
}

const SeriesQuery = z.object({
  short: z.string().regex(SHORT_RE),
  window: z.enum(["15m", "1h", "6h", "24h"]).default("1h"),
  bucket: z.enum(["1m", "5m", "15m", "1h"]).default("1m"),
  country: z.string().optional(),
  device: z.string().optional(),
});

aggRouter.get("/api/agg/series", async (req, res) => {
  const parsed = SeriesQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });
  const { short, window, bucket } = parsed.data;

  const countries = parseCsv(parsed.data.country, (s) => COUNTRY_RE.test(s));
  const devices = parseCsv(parsed.data.device, (s) => DEVICE_VALUES.has(s));
  if (
    (parsed.data.country !== undefined && countries === null) ||
    (parsed.data.device !== undefined && devices === null)
  ) {
    return res.status(400).json({ error: "invalid_filter" });
  }

  const { series, bucketSeconds } = await runSeries(short, window, bucket, countries, devices);
  return res.json({ short, window, bucket, bucketSeconds, series });
});

const BreakdownQuery = z.object({
  short: z.string().regex(SHORT_RE),
  dim: z.enum(["country", "device", "referrer"]),
  limit: z.coerce.number().int().positive().max(50).default(20),
  country: z.string().optional(),
  device: z.string().optional(),
});

aggRouter.get("/api/agg/breakdown", async (req, res) => {
  const parsed = BreakdownQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });
  const { short, dim, limit } = parsed.data;

  const countries = parseCsv(parsed.data.country, (s) => COUNTRY_RE.test(s));
  const devices = parseCsv(parsed.data.device, (s) => DEVICE_VALUES.has(s));
  if (
    (parsed.data.country !== undefined && countries === null) ||
    (parsed.data.device !== undefined && devices === null)
  ) {
    return res.status(400).json({ error: "invalid_filter" });
  }

  const result = await runBreakdown(short, dim, limit, countries, devices);
  return res.json({ short, dim, ...result });
});

// Snapshot: series + all requested breakdowns in one round-trip. The dashboard
// uses this so every filter toggle is one client request instead of four.
const SnapshotQuery = z.object({
  short: z.string().regex(SHORT_RE),
  window: z.enum(["15m", "1h", "6h", "24h"]).default("1h"),
  bucket: z.enum(["1m", "5m", "15m", "1h"]).default("1m"),
  dims: z.string().default("country,device,referrer"),
  limit: z.coerce.number().int().positive().max(50).default(20),
  country: z.string().optional(),
  device: z.string().optional(),
});

aggRouter.get("/api/agg/snapshot", async (req, res) => {
  const parsed = SnapshotQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });
  const { short, window, bucket, limit } = parsed.data;

  const dims = parsed.data.dims
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (dims.length === 0 || dims.some((d) => !DIM_VALUES.has(d))) {
    return res.status(400).json({ error: "invalid_dims" });
  }

  const countries = parseCsv(parsed.data.country, (s) => COUNTRY_RE.test(s));
  const devices = parseCsv(parsed.data.device, (s) => DEVICE_VALUES.has(s));
  if (
    (parsed.data.country !== undefined && countries === null) ||
    (parsed.data.device !== undefined && devices === null)
  ) {
    return res.status(400).json({ error: "invalid_filter" });
  }

  // Run series + filtered total + every requested breakdown in parallel
  // against the pool. With the composite indexes each query is sub-5ms
  // server-side, so this is ~one network RTT total.
  const [series, total, ...breakdowns] = await Promise.all([
    runSeries(short, window, bucket, countries, devices),
    runTotal(short, countries, devices),
    ...dims.map((d) => runBreakdown(short, d as Dim, limit, countries, devices)),
  ]);

  const breakdownsByDim: Record<string, BreakdownResult> = {};
  dims.forEach((d, i) => {
    const b = breakdowns[i];
    if (b) breakdownsByDim[d] = b;
  });

  return res.json({
    short,
    window,
    bucket,
    bucketSeconds: series.bucketSeconds,
    series: series.series,
    total,
    breakdowns: breakdownsByDim,
  });
});
