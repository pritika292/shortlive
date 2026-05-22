import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(authRouter);

  return app;
}
