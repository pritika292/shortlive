import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { authRouter } from "./routes/auth.js";
import { shortenRouter } from "./routes/shorten.js";
import { redirectRouter } from "./routes/redirect.js";
import { sessionMiddleware } from "./middleware/session.js";

const CLIENT_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../client");

// Paths that should serve the SPA's index.html rather than fall through to the
// :short redirect. Anything not on this allowlist that's a single segment is
// treated as a short code.
const SPA_PATHS = ["/", "/demo"];

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(sessionMiddleware);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(authRouter);
  app.use(shortenRouter);

  // Serve the built SPA when it exists (production / post-build).
  const indexHtml = path.join(CLIENT_DIST, "index.html");
  const hasClient = existsSync(indexHtml);
  if (hasClient) {
    app.use(
      "/assets",
      express.static(path.join(CLIENT_DIST, "assets"), { immutable: true, maxAge: "1y" }),
    );
    for (const p of SPA_PATHS) {
      app.get(p, (_req, res) => {
        res.sendFile(indexHtml);
      });
    }
  }

  app.use(redirectRouter);

  return app;
}
