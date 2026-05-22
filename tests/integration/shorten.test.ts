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

describeIfDb("POST /shorten", () => {
  let client: pg.Client;
  const app = createApp();
  let cookie: string;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await resetDb(client);
    await client.query("INSERT INTO auth.users(username, password_hash) VALUES($1, $2)", [
      "alice",
      await hash("pw"),
    ]);
    const login = await request(app).post("/login").send({ username: "alice", password: "pw" });
    cookie = sidCookie(login.headers["set-cookie"]);
  });

  afterAll(async () => {
    await client.end();
    await closePool();
  });

  it("returns 401 for anonymous request", async () => {
    const res = await request(app).post("/shorten").send({ target: "https://example.com" });
    expect(res.status).toBe(401);
  });

  it("returns 200 + 7-char short for authed valid URL", async () => {
    const res = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com/path?q=1" });
    expect(res.status).toBe(200);
    expect(res.body.short).toMatch(/^[0-9A-Za-z]{7}$/);
    expect(res.body.url).toMatch(/^http:\/\/localhost:\d+\/[0-9A-Za-z]{7}$/);
  });

  it("attributes the link to the logged-in user", async () => {
    const res = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com" });
    const { rows } = await client.query<{ owner_username: string }>(
      `SELECT u.username AS owner_username
         FROM urls JOIN auth.users u ON u.id = urls.owner_id
        WHERE short = $1`,
      [res.body.short],
    );
    expect(rows[0]?.owner_username).toBe("alice");
  });

  it("rejects invalid URLs with 400", async () => {
    const res = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "not a url" });
    expect(res.status).toBe(400);
  });

  it("rejects non-http schemes", async () => {
    for (const target of ["javascript:alert(1)", "data:text/html,foo", "ftp://example.com"]) {
      const res = await request(app).post("/shorten").set("Cookie", cookie).send({ target });
      expect(res.status).toBe(400);
    }
  });
});
