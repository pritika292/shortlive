import { Router } from "express";
import { randomBytes } from "node:crypto";
import { nanoid } from "nanoid";
import { getPool } from "../db/pool.js";
import { config } from "../config.js";
import { hash } from "../services/passwords.js";
import { createSession } from "../services/sessions.js";
import { SESSION_COOKIE } from "./auth.js";

export const quickstartRouter: Router = Router();

// 30 minutes. Long enough for a founder to create a link, fire a few clicks,
// and look at the rules tab; short enough that abandoned playground users
// vacate the table on their own.
const QUICKSTART_TTL_MS = 30 * 60_000;

// One quickstart per IP per 5 minutes. Stops a bored visitor from filling the
// table with throwaway users. In-memory only because we run on a single
// instance; if we ever scale out, move to Redis.
const RATE_LIMIT_WINDOW_MS = 5 * 60_000;
const rateLimit = new Map<string, number>();

function passRateLimit(ip: string): boolean {
  const now = Date.now();
  const last = rateLimit.get(ip);
  if (last !== undefined && now - last < RATE_LIMIT_WINDOW_MS) return false;
  rateLimit.set(ip, now);
  // Sweep ancient entries so the map doesn't grow forever.
  if (rateLimit.size > 1000) {
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    for (const [k, v] of rateLimit) {
      if (v < cutoff) rateLimit.delete(k);
    }
  }
  return true;
}

// POST /api/quickstart: one-click playground session. No username, no
// password, no form. The internal auth.users row is created with an
// auto-generated username and a random throwaway password hash so the
// existing NOT NULL constraints are satisfied; the user never sees either.
// The sid cookie is the auth handle for the rest of the session.
quickstartRouter.post("/api/quickstart", async (req, res) => {
  const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown").toString();
  if (!passRateLimit(ip)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const username = `temp-${nanoid(10).toLowerCase()}`;
  // Random throwaway secret. No one will ever try to log in with it; the
  // cookie session is the only path to authenticate as this user.
  const password = randomBytes(32).toString("base64url");
  const passwordHash = await hash(password);
  const expiresAt = new Date(Date.now() + QUICKSTART_TTL_MS);

  const pool = getPool();
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO auth.users(username, password_hash, display_name, expires_at)
       VALUES($1, $2, $3, $4)
       RETURNING id`,
    [username, passwordHash, "Playground user", expiresAt],
  );
  const row = rows[0];
  if (!row) {
    return res.status(500).json({ error: "user_create_failed" });
  }
  const userId = Number(row.id);
  const session = await createSession(pool, userId);

  res.cookie(SESSION_COOKIE, session.sid, {
    httpOnly: true,
    secure: config().NODE_ENV === "production",
    sameSite: "lax",
    expires: session.expiresAt,
    path: "/",
  });
  return res.json({
    username,
    expires_at: expiresAt.toISOString(),
    temp: true,
  });
});

// Test helper: reset the in-memory rate-limit table between tests.
export function _resetQuickstartRateLimitForTests(): void {
  rateLimit.clear();
}
