import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { shortenRouter } from "./routes/shorten.js";
import { redirectRouter } from "./routes/redirect.js";
import { sessionMiddleware } from "./middleware/session.js";

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
  app.use(redirectRouter);

  return app;
}
