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

describeIfDb("session middleware + logout", () => {
  let client: pg.Client;
  const app = createApp();

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await resetDb(client);
    const passwordHash = await hash("correctpassword");
    await client.query("INSERT INTO auth.users(username, password_hash) VALUES($1, $2)", [
      "alice",
      passwordHash,
    ]);
  });

  afterAll(async () => {
    await client.end();
    await closePool();
  });

  it("/whoami returns 401 without a cookie", async () => {
    const res = await request(app).get("/whoami");
    expect(res.status).toBe(401);
  });

  it("/whoami returns the user after login", async () => {
    const login = await request(app)
      .post("/login")
      .send({ username: "alice", password: "correctpassword" });
    const cookie = sidCookie(login.headers["set-cookie"]);
    const res = await request(app).get("/whoami").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe("alice");
  });

  it("POST /logout clears the session row + cookie", async () => {
    const login = await request(app)
      .post("/login")
      .send({ username: "alice", password: "correctpassword" });
    const cookie = sidCookie(login.headers["set-cookie"]);

    const logout = await request(app).post("/logout").set("Cookie", cookie);
    expect(logout.status).toBe(200);
    const cleared = logout.headers["set-cookie"];
    const clearedArr = Array.isArray(cleared) ? cleared : [cleared];
    expect(clearedArr.some((c) => c?.startsWith("sid=;"))).toBe(true);

    const { rows } = await client.query<{ count: string }>("SELECT COUNT(*)::text FROM sessions");
    expect(Number(rows[0]!.count)).toBe(0);

    const whoami = await request(app).get("/whoami").set("Cookie", cookie);
    expect(whoami.status).toBe(401);
  });

  it("deleted session row makes the cookie unusable (simulates expiry)", async () => {
    const login = await request(app)
      .post("/login")
      .send({ username: "alice", password: "correctpassword" });
    const cookie = sidCookie(login.headers["set-cookie"]);

    await client.query("DELETE FROM sessions");

    const res = await request(app).get("/whoami").set("Cookie", cookie);
    expect(res.status).toBe(401);
  });

  it("ignores stale cookies pointing at a missing session", async () => {
    const res = await request(app).get("/whoami").set("Cookie", "sid=nonsense");
    expect(res.status).toBe(401);
  });
});
