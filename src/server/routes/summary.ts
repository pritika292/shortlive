import { Router } from "express";
import { getPool } from "../db/pool.js";

export const summaryRouter: Router = Router();

summaryRouter.get("/api/short/:short/summary", async (req, res) => {
  const short = req.params.short;
  if (!/^[0-9A-Za-z-]{3,32}$/.test(short)) {
    return res.status(400).json({ error: "invalid_short" });
  }
  const { rows } = await getPool().query<{ total: string; first_seen: Date | null }>(
    `SELECT COUNT(*)::text AS total, MIN(ts) AS first_seen
       FROM clicks
      WHERE url_id = (SELECT id FROM urls WHERE short = $1)`,
    [short],
  );
  const row = rows[0];
  if (!row) return res.status(404).json({ error: "not_found" });
  return res.json({
    short,
    totalClicks: Number(row.total),
    firstSeenAt: row.first_seen ? row.first_seen.toISOString() : null,
  });
});
