import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db/pool.js";
import { verify } from "../services/passwords.js";
import { createSession, deleteSession } from "../services/sessions.js";

export const SESSION_COOKIE = "sid";

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const authRouter: Router = Router();

authRouter.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request" });
  }
  const { username, password } = parsed.data;
  const pool = getPool();

  const { rows } = await pool.query<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM auth.users WHERE username = $1",
    [username],
  );

  // Always run a verify even on missing user to keep response time constant
  // (prevents timing-based user enumeration).
  const row = rows[0];
  const storedHash =
    row?.password_hash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali";
  const ok = await verify(password, storedHash);
  if (!ok || !row) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const userId = Number(row.id);
  const session = await createSession(pool, userId);
  await pool.query("UPDATE auth.users SET last_login_at = NOW() WHERE id = $1", [userId]);

  res.cookie(SESSION_COOKIE, session.sid, {
    httpOnly: true,
    // See note in quickstart.ts: plain HTTP would drop a Secure cookie.
    secure: false,
    sameSite: "lax",
    expires: session.expiresAt,
    path: "/",
  });
  return res.json({ ok: true, username });
});

authRouter.post("/logout", async (req, res) => {
  const sid = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (sid) {
    await deleteSession(getPool(), sid);
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

authRouter.get("/whoami", (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const body: { username: string; expires_at?: string; temp?: true } = {
    username: req.user.username,
  };
  // Tell the client this is a temp playground session so the TopBar can
  // render the countdown chip instead of the username pill.
  if (req.user.expiresAt) {
    body.expires_at = req.user.expiresAt.toISOString();
    body.temp = true;
  }
  res.json(body);
});
