import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db/pool.js";

export const aggRouter: Router = Router();

const SHORT_RE = /^[0-9A-Za-z-]{3,32}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const DEVICE_VALUES = new Set(["desktop", "mobile", "tablet"]);

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

const SeriesQuery = z.object({
  short: z.string().regex(SHORT_RE),
  window: z.enum(["15m", "1h", "6h", "24h"]).default("1h"),
  bucket: z.enum(["1m", "5m", "15m", "1h"]).default("1m"),
  country: z.string().optional(),
  device: z.string().optional(),
});

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

  const since = new Date(Date.now() - (WINDOW_MS[window] ?? 60 * 60_000));
  const bucketSec = BUCKET_SECONDS[bucket] ?? 60;

  const params: unknown[] = [short, since, bucketSec];
  const filters: string[] = [];
  if (countries) {
    params.push(countries);
    filters.push(`AND country = ANY($${params.length}::text[])`);
  }
  if (devices) {
    params.push(devices);
    filters.push(`AND device = ANY($${params.length}::text[])`);
  }

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

  return res.json({
    short,
    window,
    bucket,
    bucketSeconds: bucketSec,
    series: rows.map((r) => ({ ts: r.ts.getTime(), count: Number(r.count) })),
  });
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

  // Whitelisted column.
  const column = dim;
  const params: unknown[] = [short];
  const filters: string[] = [];
  if (countries) {
    params.push(countries);
    filters.push(`AND country = ANY($${params.length}::text[])`);
  }
  if (devices) {
    params.push(devices);
    filters.push(`AND device = ANY($${params.length}::text[])`);
  }
  params.push(limit);
  const limitIdx = params.length;

  const { rows } = await getPool().query<{ value: string | null; count: string; total: string }>(
    `WITH base AS (
       SELECT ${column} AS value
         FROM clicks
        WHERE url_id = (SELECT id FROM urls WHERE short = $1)
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
  return res.json({
    short,
    dim,
    total,
    rows: rows.map((r) => ({
      value: r.value ?? "(unknown)",
      count: Number(r.count),
      percent: total > 0 ? Number(((Number(r.count) / total) * 100).toFixed(1)) : 0,
    })),
  });
});
