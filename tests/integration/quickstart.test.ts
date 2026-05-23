import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import pg from "pg";
import { createApp } from "../../src/server/app.js";
import { closePool } from "../../src/server/db/pool.js";
import { resetDb } from "../helpers/db.js";
import {
  _resetQuickstartRateLimitForTests,
  _seedQuickstartRateLimitForTests,
} from "../../src/server/routes/quickstart.js";
import { sweepExpiredUsers } from "../../src/server/services/temp_user_sweeper.js";
import { SESSION_COOKIE } from "../../src/server/routes/auth.js";

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("POST /api/quickstart", () => {
  let client: pg.Client;
  const app = createApp();

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await resetDb(client);
    _resetQuickstartRateLimitForTests();
  });

  afterEach(() => {
    _resetQuickstartRateLimitForTests();
  });

  afterAll(async () => {
    await client.end();
    await closePool();
  });

  it("creates a temp user with expires_at and sets the sid cookie", async () => {
    const res = await request(app).post("/api/quickstart").send({});
    expect(res.status).toBe(200);
    expect(res.body.temp).toBe(true);
    expect(res.body.username).toMatch(/^temp-[a-z0-9]+$/);
    expect(res.body.expires_at).toBeDefined();
    expect(res.headers["set-cookie"]?.[0]).toMatch(new RegExp(`^${SESSION_COOKIE}=`));

    const { rows } = await client.query<{ expires_at: Date; username: string }>(
      "SELECT expires_at, username FROM auth.users WHERE username = $1",
      [res.body.username],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.expires_at).toBeInstanceOf(Date);
    // ~30 min from now, give or take a few seconds for test runtime.
    const minutesUntilExpiry = (rows[0]!.expires_at.getTime() - Date.now()) / 60_000;
    expect(minutesUntilExpiry).toBeGreaterThan(29);
    expect(minutesUntilExpiry).toBeLessThan(31);
  });

  it("429s the 51st quickstart from the same IP within an hour", async () => {
    // Pre-fill 50 hits for ::ffff:127.0.0.1 (supertest's default source) so
    // we don't have to actually fire 50 bcrypt-bound requests.
    _seedQuickstartRateLimitForTests("::ffff:127.0.0.1", 50);
    // Also seed plain 127.0.0.1 in case node serves it under v4.
    _seedQuickstartRateLimitForTests("127.0.0.1", 50);

    const overflow = await request(app).post("/api/quickstart").send({});
    expect(overflow.status).toBe(429);
    expect(overflow.body.error).toBe("ip_rate_limited");
  });

  it("counts per-IP not globally (different X-Forwarded-For = different bucket)", async () => {
    // Burn the bucket for one IP without doing the slow bcrypt path.
    _seedQuickstartRateLimitForTests("10.10.10.10", 50);
    // A different IP should still pass on its first try.
    const fresh = await request(app)
      .post("/api/quickstart")
      .set("X-Forwarded-For", "10.10.10.11")
      .send({});
    expect(fresh.status).toBe(200);
    // While the burned IP is blocked.
    const blocked = await request(app)
      .post("/api/quickstart")
      .set("X-Forwarded-For", "10.10.10.10")
      .send({});
    expect(blocked.status).toBe(429);
  });

  it("returns 429 with playground_at_capacity once 200 live temp users exist", async () => {
    // Seed 200 unexpired temp users straight into the DB. Hash isn't used
    // anywhere; just satisfy NOT NULL.
    const values: string[] = [];
    const params: unknown[] = [];
    for (let i = 0; i < 200; i++) {
      const idx = i * 3;
      values.push(`($${idx + 1}, $${idx + 2}, $${idx + 3})`);
      params.push(
        `temp-capacity${i.toString().padStart(3, "0")}`,
        "unused",
        new Date(Date.now() + 30 * 60_000),
      );
    }
    await client.query(
      `INSERT INTO auth.users(username, password_hash, expires_at) VALUES ${values.join(", ")}`,
      params,
    );

    const res = await request(app).post("/api/quickstart").send({});
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("playground_at_capacity");
  });

  it("returns the playground info on /whoami while the session is live", async () => {
    const start = await request(app).post("/api/quickstart").send({});
    const cookie = start.headers["set-cookie"]?.[0]?.split(";")[0];
    expect(cookie).toBeDefined();

    const who = await request(app).get("/whoami").set("Cookie", cookie!);
    expect(who.status).toBe(200);
    expect(who.body.temp).toBe(true);
    expect(who.body.expires_at).toBeDefined();
  });

  it("rejects /whoami after the user's expires_at has passed", async () => {
    const start = await request(app).post("/api/quickstart").send({});
    const cookie = start.headers["set-cookie"]?.[0]?.split(";")[0];
    expect(cookie).toBeDefined();

    // Backdate the user's expiry to the past.
    await client.query(
      "UPDATE auth.users SET expires_at = NOW() - INTERVAL '1 minute' WHERE username = $1",
      [start.body.username],
    );

    const who = await request(app).get("/whoami").set("Cookie", cookie!);
    expect(who.status).toBe(401);
  });

  it("sweeper deletes expired temp users and cascades their owned links", async () => {
    const start = await request(app).post("/api/quickstart").send({});
    const cookie = start.headers["set-cookie"]?.[0]?.split(";")[0];
    expect(cookie).toBeDefined();

    // The playground user owns a link.
    const created = await request(app)
      .post("/shorten")
      .set("Cookie", cookie!)
      .send({ target: "https://example.com" });
    expect(created.status).toBe(200);
    const shortBefore = (
      await client.query<{ c: string }>(
        "SELECT COUNT(*)::text AS c FROM urls WHERE owner_id = (SELECT id FROM auth.users WHERE username = $1)",
        [start.body.username],
      )
    ).rows[0]!.c;
    expect(Number(shortBefore)).toBe(1);

    // Backdate expiry and run the sweep.
    await client.query(
      "UPDATE auth.users SET expires_at = NOW() - INTERVAL '1 second' WHERE username = $1",
      [start.body.username],
    );
    const deleted = await sweepExpiredUsers();
    expect(deleted).toBeGreaterThanOrEqual(1);

    // User row gone, and the link cascaded with them.
    const userRows = await client.query<{ c: string }>(
      "SELECT COUNT(*)::text AS c FROM auth.users WHERE username = $1",
      [start.body.username],
    );
    expect(Number(userRows.rows[0]!.c)).toBe(0);
    const urlRows = await client.query<{ c: string }>(
      "SELECT COUNT(*)::text AS c FROM urls WHERE short = $1",
      [created.body.short],
    );
    expect(Number(urlRows.rows[0]!.c)).toBe(0);
  });

  it("sweeper leaves permanent users (expires_at IS NULL) untouched", async () => {
    // A permanent user inserted by hand.
    await client.query(
      `INSERT INTO auth.users(username, password_hash, expires_at)
         VALUES('permanent-alice', 'unused', NULL)`,
    );
    await sweepExpiredUsers();
    const { rows } = await client.query<{ c: string }>(
      "SELECT COUNT(*)::text AS c FROM auth.users WHERE username = 'permanent-alice'",
    );
    expect(Number(rows[0]!.c)).toBe(1);
  });
});
