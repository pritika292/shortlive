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

describeIfDb("rules CRUD", () => {
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
    const aliceLogin = await request(app)
      .post("/login")
      .send({ username: "alice", password: "pw" });
    aliceCookie = sidCookie(aliceLogin.headers["set-cookie"]);
    const bobLogin = await request(app).post("/login").send({ username: "bob", password: "pw" });
    bobCookie = sidCookie(bobLogin.headers["set-cookie"]);

    const create = await request(app)
      .post("/shorten")
      .set("Cookie", aliceCookie)
      .send({ target: "https://example.com" });
    aliceShort = create.body.short;
  });

  afterAll(async () => {
    await client.end();
    await closePool();
  });

  it("returns 401 to anonymous", async () => {
    const res = await request(app)
      .post(`/api/links/${aliceShort}/rules`)
      .send({ type: "threshold", config: { count: 5 }, destination_url: "https://x" });
    expect(res.status).toBe(401);
  });

  it("returns 403 to a non-owner", async () => {
    const res = await request(app)
      .post(`/api/links/${aliceShort}/rules`)
      .set("Cookie", bobCookie)
      .send({ type: "threshold", config: { count: 5 }, destination_url: "https://x" });
    expect(res.status).toBe(403);
  });

  it("owner creates a threshold rule (200 + row in PG)", async () => {
    const res = await request(app)
      .post(`/api/links/${aliceShort}/rules`)
      .set("Cookie", aliceCookie)
      .send({
        type: "threshold",
        config: { count: 5 },
        destination_url: "https://webhook.example/x",
      });
    expect(res.status).toBe(200);
    expect(res.body.rule.type).toBe("threshold");
    expect(res.body.rule.destination_verified).toBe(false);
    expect(res.body.rule.enabled).toBe(true);

    const { rows } = await client.query("SELECT COUNT(*)::text AS c FROM rules");
    expect(Number(rows[0]!.c)).toBe(1);
  });

  it("rejects invalid config (threshold missing count)", async () => {
    const res = await request(app)
      .post(`/api/links/${aliceShort}/rules`)
      .set("Cookie", aliceCookie)
      .send({ type: "threshold", config: {}, destination_url: "https://x" });
    expect(res.status).toBe(400);
  });

  it("rejects unknown rule type", async () => {
    const res = await request(app)
      .post(`/api/links/${aliceShort}/rules`)
      .set("Cookie", aliceCookie)
      .send({ type: "bogus", config: {}, destination_url: "https://x" });
    expect(res.status).toBe(400);
  });

  it("creates a velocity rule with cooldown", async () => {
    const res = await request(app)
      .post(`/api/links/${aliceShort}/rules`)
      .set("Cookie", aliceCookie)
      .send({
        type: "velocity",
        config: { count: 10, window_seconds: 30 },
        destination_url: "https://webhook.example/v",
        cooldown_seconds: 120,
      });
    expect(res.status).toBe(200);
    expect(res.body.rule.cooldown_seconds).toBe(120);
  });

  it("creates a per_click rule (filter required)", async () => {
    const ok = await request(app)
      .post(`/api/links/${aliceShort}/rules`)
      .set("Cookie", aliceCookie)
      .send({
        type: "per_click",
        config: { filters: { country: ["US", "DE"] } },
        destination_url: "https://x",
      });
    expect(ok.status).toBe(200);

    const bad = await request(app)
      .post(`/api/links/${aliceShort}/rules`)
      .set("Cookie", aliceCookie)
      .send({
        type: "per_click",
        config: { filters: {} },
        destination_url: "https://x",
      });
    expect(bad.status).toBe(400);
  });

  it("lists, patches, and deletes rules", async () => {
    const created = await request(app)
      .post(`/api/links/${aliceShort}/rules`)
      .set("Cookie", aliceCookie)
      .send({
        type: "threshold",
        config: { count: 5 },
        destination_url: "https://x",
      });
    const rid = created.body.rule.id;

    const list = await request(app)
      .get(`/api/links/${aliceShort}/rules`)
      .set("Cookie", aliceCookie);
    expect(list.body.rules).toHaveLength(1);

    const patch = await request(app)
      .patch(`/api/links/${aliceShort}/rules/${rid}`)
      .set("Cookie", aliceCookie)
      .send({ enabled: false });
    expect(patch.status).toBe(200);
    expect(patch.body.rule.enabled).toBe(false);

    const patchUrl = await request(app)
      .patch(`/api/links/${aliceShort}/rules/${rid}`)
      .set("Cookie", aliceCookie)
      .send({ destination_url: "https://other.example/" });
    expect(patchUrl.body.rule.destination_url).toBe("https://other.example/");
    expect(patchUrl.body.rule.destination_verified).toBe(false);

    const del = await request(app)
      .delete(`/api/links/${aliceShort}/rules/${rid}`)
      .set("Cookie", aliceCookie);
    expect(del.status).toBe(200);

    const finalList = await request(app)
      .get(`/api/links/${aliceShort}/rules`)
      .set("Cookie", aliceCookie);
    expect(finalList.body.rules).toHaveLength(0);
  });

  it("cascades on link delete", async () => {
    await request(app)
      .post(`/api/links/${aliceShort}/rules`)
      .set("Cookie", aliceCookie)
      .send({
        type: "threshold",
        config: { count: 5 },
        destination_url: "https://x",
      });
    await client.query("DELETE FROM urls WHERE short = $1", [aliceShort]);
    const { rows } = await client.query("SELECT COUNT(*)::text AS c FROM rules");
    expect(Number(rows[0]!.c)).toBe(0);
  });
});
