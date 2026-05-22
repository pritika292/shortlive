import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import pg from "pg";
import { createApp } from "../../src/server/app.js";
import { hash } from "../../src/server/services/passwords.js";
import { resetDb } from "../helpers/db.js";
import { closePool } from "../../src/server/db/pool.js";

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

function sidCookie(setCookie: string[] | string | undefined): string {
  const arr = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const sid = arr.find((c) => c.startsWith("sid="));
  if (!sid) throw new Error("no sid cookie set");
  return sid.split(";")[0]!;
}

async function waitForClicks(
  client: pg.Client,
  urlId: number,
  expected: number,
  timeoutMs = 2000,
): Promise<number> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const {
      rows: [row],
    } = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text FROM clicks WHERE url_id = $1",
      [urlId],
    );
    const n = Number(row!.count);
    if (n >= expected) return n;
    await new Promise((r) => setTimeout(r, 25));
  }
  return -1;
}

describeIfDb("click logging", () => {
  let client: pg.Client;
  const app = createApp();
  let cookie: string;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await resetDb(client);
    await client.query("INSERT INTO auth.users(username, password_hash) VALUES('alice', $1)", [
      await hash("pw"),
    ]);
    const login = await request(app).post("/login").send({ username: "alice", password: "pw" });
    cookie = sidCookie(login.headers["set-cookie"]);
  });

  afterAll(async () => {
    await client.end();
    await closePool();
  });

  it("inserts a clicks row after a successful redirect", async () => {
    const create = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com" });
    const {
      rows: [{ id }],
    } = await client.query<{ id: string }>("SELECT id FROM urls WHERE short = $1", [
      create.body.short,
    ]);

    const redir = await request(app)
      .get(`/${create.body.short}`)
      .set("User-Agent", "test-agent/1.0")
      .set("Referer", "https://hn.example.com/");
    expect(redir.status).toBe(302);

    const n = await waitForClicks(client, Number(id!), 1);
    expect(n).toBe(1);

    const { rows } = await client.query<{
      user_agent: string;
      referrer: string;
      ip_hash: string;
      country: string | null;
      device: string | null;
    }>("SELECT user_agent, referrer, ip_hash, country, device FROM clicks WHERE url_id = $1", [id]);
    expect(rows[0]!.user_agent).toBe("test-agent/1.0");
    expect(rows[0]!.referrer).toBe("https://hn.example.com/");
    expect(rows[0]!.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]!.device).not.toBeNull();
  });

  it("does not log a click on 404", async () => {
    await request(app).get("/missing1");
    const {
      rows: [row],
    } = await client.query<{ count: string }>("SELECT COUNT(*)::text FROM clicks");
    expect(Number(row!.count)).toBe(0);
  });

  it("logs a click only after the unlock for a password-gated link", async () => {
    const create = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com", password: "letmein" });
    const {
      rows: [{ id }],
    } = await client.query<{ id: string }>("SELECT id FROM urls WHERE short = $1", [
      create.body.short,
    ]);

    await request(app).get(`/${create.body.short}`);
    // wait a tick for any potential logging
    await new Promise((r) => setTimeout(r, 100));
    const {
      rows: [row1],
    } = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text FROM clicks WHERE url_id = $1",
      [id],
    );
    expect(Number(row1!.count)).toBe(0);

    await request(app)
      .post(`/${create.body.short}/unlock`)
      .type("form")
      .send({ password: "letmein" });
    const n = await waitForClicks(client, Number(id!), 1);
    expect(n).toBe(1);
  });
});
