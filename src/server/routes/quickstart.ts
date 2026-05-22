import { Router } from "express";
import { randomBytes } from "node:crypto";
import { customAlphabet } from "nanoid";
import { getPool } from "../db/pool.js";
import { config } from "../config.js";
import { hash } from "../services/passwords.js";
import { createSession } from "../services/sessions.js";
import { SESSION_COOKIE } from "./auth.js";

// Lowercase alphanumeric only: nanoid's default alphabet includes _ and -
// which look ugly in an auto-generated username. 10 chars * 36 = ~52 bits
// of entropy, plenty for non-cryptographic uniqueness.
const tempIdSuffix = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

export const quickstartRouter: Router = Router();

// 30 minutes. Long enough for a founder to create a link, fire a few clicks,
// and look at the rules tab; short enough that abandoned playground users
// vacate the table on their own.
const QUICKSTART_TTL_MS = 30 * 60_000;

// Soft global cap on live playground users. Way above any realistic visitor
// pattern but bounds what an abuser could pile up before the sweeper catches
// up on its 5-minute interval. We removed the per-IP rate limit because
// Docker port-publishing NATs every inbound request to the bridge IP, which
// made the IP gate produce false positives that blocked legitimate first-time
// visitors.
const MAX_LIVE_TEMP_USERS = 200;

// POST /api/quickstart: one-click playground session. No username, no
// password, no form. The internal auth.users row is created with an
// auto-generated username and a random throwaway password hash so the
// existing NOT NULL constraints are satisfied; the user never sees either.
// The sid cookie is the auth handle for the rest of the session.
quickstartRouter.post("/api/quickstart", async (req, res) => {
  const pool = getPool();

  // Soft cap check: count temp users whose TTL hasn't elapsed. The sweeper
  // (5-min interval) brings this back down automatically.
  const liveCountRes = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c
       FROM auth.users
      WHERE expires_at IS NOT NULL
        AND expires_at > NOW()`,
  );
  if (Number(liveCountRes.rows[0]?.c ?? 0) >= MAX_LIVE_TEMP_USERS) {
    return res.status(429).json({ error: "playground_at_capacity" });
  }

  const username = `temp-${tempIdSuffix()}`;
  // Random throwaway secret. No one will ever try to log in with it; the
  // cookie session is the only path to authenticate as this user.
  const password = randomBytes(32).toString("base64url");
  const passwordHash = await hash(password);
  const expiresAt = new Date(Date.now() + QUICKSTART_TTL_MS);

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

// Test helper kept as a no-op for backwards compatibility with any tests that
// still call it from a previous version. The rate-limit table no longer
// exists; this just lets old test imports compile.
export function _resetQuickstartRateLimitForTests(): void {
  // intentionally empty
}
