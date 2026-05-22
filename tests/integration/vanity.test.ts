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

describeIfDb("vanity shortcodes", () => {
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

  it("accepts a valid custom_short and uses it as the short", async () => {
    const res = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com", custom_short: "hello-world" });
    expect(res.status).toBe(200);
    expect(res.body.short).toBe("hello-world");

    const redirect = await request(app).get("/hello-world");
    expect(redirect.status).toBe(302);
    expect(redirect.headers.location).toBe("https://example.com");
  });

  it("returns 409 on duplicate custom_short", async () => {
    await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com/a", custom_short: "taken" });
    const dup = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com/b", custom_short: "taken" });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe("shortcode_taken");
  });

  it("rejects slug with disallowed characters", async () => {
    const res = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com", custom_short: "has spaces" });
    expect(res.status).toBe(400);
  });

  it("rejects slug shorter than 3 chars", async () => {
    const res = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com", custom_short: "ab" });
    expect(res.status).toBe(400);
  });

  it("rejects slug longer than 32 chars", async () => {
    const res = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com", custom_short: "a".repeat(33) });
    expect(res.status).toBe(400);
  });
});
