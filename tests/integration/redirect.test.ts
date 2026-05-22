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

describeIfDb("GET /:short", () => {
  let client: pg.Client;
  const app = createApp();

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await resetDb(client);
    await client.query("INSERT INTO auth.users(username, password_hash) VALUES('alice', $1)", [
      await hash("pw"),
    ]);
  });

  afterAll(async () => {
    await client.end();
    await closePool();
  });

  it("redirects with 302 to the target URL", async () => {
    const login = await request(app).post("/login").send({ username: "alice", password: "pw" });
    const cookie = sidCookie(login.headers["set-cookie"]);
    const created = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com/a/b?c=1&d=2" });

    const res = await request(app).get(`/${created.body.short}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://example.com/a/b?c=1&d=2");
  });

  it("returns 404 for unknown shortcode", async () => {
    const res = await request(app).get("/missing1");
    expect(res.status).toBe(404);
  });

  it("does not require auth for the redirect", async () => {
    const login = await request(app).post("/login").send({ username: "alice", password: "pw" });
    const cookie = sidCookie(login.headers["set-cookie"]);
    const created = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com" });

    const res = await request(app).get(`/${created.body.short}`);
    expect(res.status).toBe(302);
  });

  it("preserves /health and /login routes (route ordering)", async () => {
    const health = await request(app).get("/health");
    expect(health.status).toBe(200);
  });
});
