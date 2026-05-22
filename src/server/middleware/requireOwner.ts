import type { RequestHandler } from "express";
import { getPool } from "../db/pool.js";

declare module "express-serve-static-core" {
  interface Request {
    ownedUrl?: { id: number; short: string };
  }
}

const SHORT_RE = /^[0-9A-Za-z-]{3,32}$/;

export const requireOwner: RequestHandler = async (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const shortParam = req.params.short;
  const short = typeof shortParam === "string" ? shortParam : "";
  if (!short || !SHORT_RE.test(short)) {
    res.status(400).json({ error: "invalid_short" });
    return;
  }
  const { rows } = await getPool().query<{ id: string; owner_id: string | null }>(
    "SELECT id, owner_id FROM urls WHERE short = $1",
    [short],
  );
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (row.owner_id === null || Number(row.owner_id) !== req.user.id) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  req.ownedUrl = { id: Number(row.id), short };
  next();
};
