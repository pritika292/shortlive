import { Router } from "express";
import { getPool } from "../db/pool.js";

export const redirectRouter: Router = Router();

redirectRouter.get("/:short", async (req, res, next) => {
  const short = req.params.short;
  // Single-segment alphanumeric + hyphen, between 3 and 32 chars. Anything
  // else either matches an actual route above or is malformed.
  if (!/^[0-9A-Za-z-]{3,32}$/.test(short)) return next();

  const { rows } = await getPool().query<{ target: string }>(
    "SELECT target FROM urls WHERE short = $1",
    [short],
  );
  const row = rows[0];
  if (!row) {
    return res.status(404).json({ error: "not_found" });
  }
  res.redirect(302, row.target);
});
