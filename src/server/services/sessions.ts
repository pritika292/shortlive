import { randomBytes } from "node:crypto";
import type pg from "pg";

const SESSION_TTL_DAYS = 30;

export interface Session {
  sid: string;
  userId: number;
  expiresAt: Date;
}

export async function createSession(db: pg.Pool | pg.PoolClient, userId: number): Promise<Session> {
  const sid = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.query("INSERT INTO sessions(sid, user_id, expires_at) VALUES($1, $2, $3)", [
    sid,
    userId,
    expiresAt,
  ]);
  return { sid, userId, expiresAt };
}

export async function lookupSession(
  db: pg.Pool | pg.PoolClient,
  sid: string,
): Promise<{ userId: number; username: string } | null> {
  const { rows } = await db.query<{ user_id: string; username: string }>(
    `SELECT s.user_id, u.username
       FROM sessions s JOIN auth.users u ON u.id = s.user_id
      WHERE s.sid = $1 AND s.expires_at > NOW()`,
    [sid],
  );
  const row = rows[0];
  if (!row) return null;
  await db.query("UPDATE sessions SET last_seen = NOW() WHERE sid = $1", [sid]);
  return { userId: Number(row.user_id), username: row.username };
}

export async function deleteSession(db: pg.Pool | pg.PoolClient, sid: string): Promise<void> {
  await db.query("DELETE FROM sessions WHERE sid = $1", [sid]);
}
