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

function unlockCookie(setCookie: string[] | string | undefined, short: string): string | null {
  const arr = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const c = arr.find((x) => x?.startsWith(`link_unlocked_${short}=`));
  return c ? c.split(";")[0]! : null;
}

describeIfDb("link expiry + password gate", () => {
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

  it("returns 410 once expires_at has passed", async () => {
    const create = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({
        target: "https://example.com",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      });
    expect(create.status).toBe(200);
    await client.query(
      "UPDATE urls SET expires_at = NOW() - INTERVAL '1 minute' WHERE short = $1",
      [create.body.short],
    );
    const res = await request(app).get(`/${create.body.short}`);
    expect(res.status).toBe(410);
  });

  it("rejects expires_at in the past at creation time", async () => {
    const res = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({
        target: "https://example.com",
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      });
    expect(res.status).toBe(400);
  });

  it("password-gated link returns 401 form without unlock cookie", async () => {
    const create = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com", password: "letmein" });
    const res = await request(app).get(`/${create.body.short}`);
    expect(res.status).toBe(401);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain('name="password"');
  });

  it("wrong password re-renders the form with an error", async () => {
    const create = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com", password: "letmein" });
    const res = await request(app)
      .post(`/${create.body.short}/unlock`)
      .type("form")
      .send({ password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.text).toContain("Incorrect password");
  });

  it("correct password sets unlock cookie and redirects", async () => {
    const create = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com", password: "letmein" });

    const unlock = await request(app)
      .post(`/${create.body.short}/unlock`)
      .type("form")
      .send({ password: "letmein" });
    expect(unlock.status).toBe(302);
    expect(unlock.headers.location).toBe("https://example.com");
    const cookieHeader = unlockCookie(unlock.headers["set-cookie"], create.body.short);
    expect(cookieHeader).not.toBeNull();

    const follow = await request(app).get(`/${create.body.short}`).set("Cookie", cookieHeader!);
    expect(follow.status).toBe(302);
  });
});
