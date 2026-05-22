import { Router } from "express";
import { getPool } from "../db/pool.js";
import { requireLogin } from "../middleware/session.js";

export const meRouter: Router = Router();

const SHORT_RE = /^[0-9A-Za-z-]{3,32}$/;

interface LinkRow {
  short: string;
  target: string;
  created_at: Date;
  expires_at: Date | null;
  click_count: string;
}

meRouter.get("/api/me/links", requireLogin, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "unauthorized" });
  const { rows } = await getPool().query<LinkRow>(
    `SELECT u.short, u.target, u.created_at, u.expires_at,
            COUNT(c.id)::text AS click_count
       FROM urls u
       LEFT JOIN clicks c ON c.url_id = u.id
      WHERE u.owner_id = $1
      GROUP BY u.id
      ORDER BY u.created_at DESC`,
    [req.user.id],
  );
  return res.json({
    links: rows.map((r) => ({
      short: r.short,
      target: r.target,
      clickCount: Number(r.click_count),
      createdAt: r.created_at.toISOString(),
      expiresAt: r.expires_at ? r.expires_at.toISOString() : null,
    })),
  });
});

meRouter.delete("/api/me/links/:short", requireLogin, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "unauthorized" });
  const shortParam = typeof req.params.short === "string" ? req.params.short : "";
  if (!SHORT_RE.test(shortParam)) {
    return res.status(400).json({ error: "invalid_short" });
  }
  const { rowCount } = await getPool().query(
    "DELETE FROM urls WHERE short = $1 AND owner_id = $2",
    [shortParam, req.user.id],
  );
  if (rowCount === 0) return res.status(404).json({ error: "not_found" });
  return res.json({ ok: true });
});
