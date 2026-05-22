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

const ShortenBody = z.object({
  target: TargetUrl,
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

  const { short } = await insertWithGeneratedShort(getPool(), {
    target: parsed.data.target,
    ownerId: req.user.id,
  });

  const cfg = config();
  const baseUrl =
    cfg.NODE_ENV === "production"
      ? `${req.protocol}://${req.get("host") ?? "localhost"}`
      : `http://localhost:${cfg.PORT}`;

  return res.json({ short, url: `${baseUrl}/${short}` });
});
