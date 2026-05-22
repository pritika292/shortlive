import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import pg from "pg";
import { createApp } from "../../src/server/app.js";
import { resetDb } from "../helpers/db.js";
import { closePool } from "../../src/server/db/pool.js";

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("GET /api/short/:short/summary", () => {
  let client: pg.Client;
  const app = createApp();

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await resetDb(client);
    await client.query(
      `INSERT INTO urls(short, target, owner_id) VALUES('demo', 'https://x', NULL)`,
    );
    await client.query(
      `INSERT INTO clicks(url_id, ts) SELECT (SELECT id FROM urls WHERE short='demo'), NOW() - (g || ' seconds')::interval FROM generate_series(1, 5) g`,
    );
  });

  afterAll(async () => {
    await client.end();
    await closePool();
  });

  it("returns the total click count and first-seen timestamp", async () => {
    const res = await request(app).get("/api/short/demo/summary");
    expect(res.status).toBe(200);
    expect(res.body.short).toBe("demo");
    expect(res.body.totalClicks).toBe(5);
    expect(new Date(res.body.firstSeenAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("returns 0 totalClicks for a link with no clicks", async () => {
    await client.query("DELETE FROM clicks");
    const res = await request(app).get("/api/short/demo/summary");
    expect(res.status).toBe(200);
    expect(res.body.totalClicks).toBe(0);
    expect(res.body.firstSeenAt).toBeNull();
  });

  it("returns 400 for a malformed short code", async () => {
    const res = await request(app).get("/api/short/!!/summary");
    expect(res.status).toBe(400);
  });
});
