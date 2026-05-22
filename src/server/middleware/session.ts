import type { RequestHandler } from "express";
import { getPool } from "../db/pool.js";
import { lookupSession } from "../services/sessions.js";
import { SESSION_COOKIE } from "../routes/auth.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: number; username: string };
  }
}

export const sessionMiddleware: RequestHandler = async (req, _res, next) => {
  const sid = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!sid) return next();
  try {
    const session = await lookupSession(getPool(), sid);
    if (session) {
      req.user = { id: session.userId, username: session.username };
    }
  } catch (err) {
    console.error("session lookup failed", err);
  }
  next();
};

export const requireLogin: RequestHandler = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
};
