import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db/pool.js";
import { requireLogin } from "../middleware/session.js";
import { insertWithGeneratedShort } from "../services/shortcode.js";
import { config } from "../config.js";

const TargetUrl = z
  .string()
  .url()
  .refine(
    (u) => {
      try {
        const parsed = new URL(u);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "target must be an http(s) URL" },
  );

const SLUG_REGEX = /^[a-zA-Z0-9-]{3,32}$/;

const ShortenBody = z.object({
  target: TargetUrl,
  custom_short: z
    .string()
    .regex(SLUG_REGEX, "custom_short must be 3-32 chars of [a-zA-Z0-9-]")
    .optional(),
});

export const shortenRouter: Router = Router();

shortenRouter.post("/shorten", requireLogin, async (req, res) => {
  const parsed = ShortenBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid_request",
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const cfg = config();
  const baseUrl =
    cfg.NODE_ENV === "production"
      ? `${req.protocol}://${req.get("host") ?? "localhost"}`
      : `http://localhost:${cfg.PORT}`;

  if (parsed.data.custom_short) {
    try {
      const { rows } = await getPool().query<{ id: string }>(
        `INSERT INTO urls(short, target, owner_id) VALUES($1, $2, $3) RETURNING id`,
        [parsed.data.custom_short, parsed.data.target, req.user.id],
      );
      if (!rows[0]) throw new Error("INSERT returned no row");
      return res.json({
        short: parsed.data.custom_short,
        url: `${baseUrl}/${parsed.data.custom_short}`,
      });
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        return res.status(409).json({ error: "shortcode_taken" });
      }
      throw err;
    }
  }

  const { short } = await insertWithGeneratedShort(getPool(), {
    target: parsed.data.target,
    ownerId: req.user.id,
  });

  return res.json({ short, url: `${baseUrl}/${short}` });
});
