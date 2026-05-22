import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import pg from "pg";
import { createApp } from "../../src/server/app.js";
import { hash } from "../../src/server/services/passwords.js";
import { resetDb } from "../helpers/db.js";
import { closePool } from "../../src/server/db/pool.js";

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("POST /login", () => {
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

  it("returns 200 + sid cookie on valid credentials", async () => {
    const res = await request(app)
      .post("/login")
      .send({ username: "alice", password: "correctpassword" });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe("alice");
    const cookieHeader = res.headers["set-cookie"];
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
    expect(cookies.some((c) => c?.startsWith("sid="))).toBe(true);
    expect(cookies.some((c) => c?.toLowerCase().includes("httponly"))).toBe(true);
  });

  it("returns 401 on wrong password", async () => {
    const res = await request(app)
      .post("/login")
      .send({ username: "alice", password: "wrongpassword" });
    expect(res.status).toBe(401);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("returns 401 on unknown username with the same shape (no user enumeration)", async () => {
    const res = await request(app).post("/login").send({ username: "noone", password: "whatever" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "invalid_credentials" });
  });

  it("returns 400 on malformed body", async () => {
    const res = await request(app).post("/login").send({ username: "alice" });
    expect(res.status).toBe(400);
  });

  it("persists a sessions row on successful login", async () => {
    await request(app).post("/login").send({ username: "alice", password: "correctpassword" });
    const { rows } = await client.query<{ count: string }>("SELECT COUNT(*)::text FROM sessions");
    expect(Number(rows[0]!.count)).toBe(1);
  });

  it("updates auth.users.last_login_at on success", async () => {
    await request(app).post("/login").send({ username: "alice", password: "correctpassword" });
    const { rows } = await client.query<{ last_login_at: Date | null }>(
      "SELECT last_login_at FROM auth.users WHERE username = 'alice'",
    );
    expect(rows[0]!.last_login_at).not.toBeNull();
  });
});
