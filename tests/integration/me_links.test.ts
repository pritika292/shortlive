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
  if (!sid) throw new Error("no sid cookie");
  return sid.split(";")[0]!;
}

describeIfDb("GET + DELETE /api/me/links", () => {
  let client: pg.Client;
  const app = createApp();
  let aliceCookie: string;
  let bobCookie: string;
  let aliceShort: string;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await resetDb(client);
    const pw = await hash("pw");
    await client.query(
      "INSERT INTO auth.users(username, password_hash) VALUES('alice', $1), ('bob', $1)",
      [pw],
    );
    aliceCookie = sidCookie(
      (await request(app).post("/login").send({ username: "alice", password: "pw" })).headers[
        "set-cookie"
      ],
    );
    bobCookie = sidCookie(
      (await request(app).post("/login").send({ username: "bob", password: "pw" })).headers[
        "set-cookie"
      ],
    );

    aliceShort = (
      await request(app)
        .post("/shorten")
        .set("Cookie", aliceCookie)
        .send({ target: "https://example.com/alice" })
    ).body.short;
    // Seed a click so click_count > 0
    await client.query(`INSERT INTO clicks(url_id) SELECT id FROM urls WHERE short = $1`, [
      aliceShort,
    ]);
  });

  afterAll(async () => {
    await client.end();
    await closePool();
  });

  it("GET /api/me/links returns 401 for guests", async () => {
    const res = await request(app).get("/api/me/links");
    expect(res.status).toBe(401);
  });

  it("GET /api/me/links returns the caller's links only", async () => {
    // Bob has no links yet
    const bobRes = await request(app).get("/api/me/links").set("Cookie", bobCookie);
    expect(bobRes.status).toBe(200);
    expect(bobRes.body.links).toEqual([]);

    const aliceRes = await request(app).get("/api/me/links").set("Cookie", aliceCookie);
    expect(aliceRes.status).toBe(200);
    expect(aliceRes.body.links).toHaveLength(1);
    expect(aliceRes.body.links[0].short).toBe(aliceShort);
    expect(aliceRes.body.links[0].clickCount).toBe(1);
    expect(aliceRes.body.links[0].target).toBe("https://example.com/alice");
  });

  it("DELETE returns 401 for guests", async () => {
    const res = await request(app).delete(`/api/me/links/${aliceShort}`);
    expect(res.status).toBe(401);
  });

  it("DELETE returns 404 for a link not owned by the caller", async () => {
    const res = await request(app).delete(`/api/me/links/${aliceShort}`).set("Cookie", bobCookie);
    expect(res.status).toBe(404);
  });

  it("DELETE returns 200 for the owner and cascades clicks", async () => {
    const res = await request(app).delete(`/api/me/links/${aliceShort}`).set("Cookie", aliceCookie);
    expect(res.status).toBe(200);

    const { rows: urls } = await client.query("SELECT 1 FROM urls WHERE short = $1", [aliceShort]);
    expect(urls).toHaveLength(0);
    const { rows: clicks } = await client.query<{ c: string }>(
      "SELECT COUNT(*)::text AS c FROM clicks",
    );
    expect(Number(clicks[0]!.c)).toBe(0);
  });

  it("DELETE returns 400 for a malformed short", async () => {
    const res = await request(app).delete("/api/me/links/!!").set("Cookie", aliceCookie);
    expect(res.status).toBe(400);
  });
});
