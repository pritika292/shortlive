import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { sessionMiddleware } from "./middleware/session.js";

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(sessionMiddleware);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(authRouter);

  return app;
}
