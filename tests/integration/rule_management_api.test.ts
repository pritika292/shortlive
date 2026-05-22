import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import request from "supertest";
import pg from "pg";
import Redis from "ioredis";
import { createApp } from "../../src/server/app.js";
import { hash } from "../../src/server/services/passwords.js";
import { resetDb } from "../helpers/db.js";
import { closePool, getPool } from "../../src/server/db/pool.js";
import { closeRedis } from "../../src/server/services/redis.js";
import { closeWebhookQueue, getWebhookQueue } from "../../src/server/services/queue.js";

const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;
const describeIfDeps = DATABASE_URL && REDIS_URL ? describe : describe.skip;

function sidCookie(setCookie: string[] | string | undefined): string {
  const arr = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const sid = arr.find((c) => c.startsWith("sid="));
  if (!sid) throw new Error("no sid cookie");
  return sid.split(";")[0]!;
}

async function makeEchoingSink(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c.toString()));
    req.on("end", () => {
      try {
        const j = JSON.parse(body) as { verification_nonce?: string };
        if (j.verification_nonce) {
          res.writeHead(200);
          res.end(j.verification_nonce);
          return;
        }
      } catch {
        // not a handshake — fall through
      }
      res.writeHead(200);
      res.end("ok");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

describeIfDeps("rule management API (handshake + retry)", () => {
  let client: pg.Client;
  let adminRedis: Redis;
  const app = createApp();
  let cookie: string;
  let short: string;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    adminRedis = new Redis(REDIS_URL!);
  });

  beforeEach(async () => {
    await resetDb(client);
    await adminRedis.flushdb();
    await getWebhookQueue().obliterate({ force: true });

    await client.query("INSERT INTO auth.users(username, password_hash) VALUES('alice', $1)", [
      await hash("pw"),
    ]);
    const login = await request(app).post("/login").send({ username: "alice", password: "pw" });
    cookie = sidCookie(login.headers["set-cookie"]);
    const create = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com" });
    short = create.body.short;
  });

  afterAll(async () => {
    await closeWebhookQueue();
    await client.end();
    await adminRedis.quit();
    await closeRedis();
    await closePool();
  });

  it("auto-verifies a rule on create when the sink echoes the nonce", async () => {
    const sink = await makeEchoingSink();
    try {
      const res = await request(app)
        .post(`/api/links/${short}/rules`)
        .set("Cookie", cookie)
        .send({
          type: "threshold",
          config: { count: 1 },
          destination_url: sink.url,
        });
      const ruleId = res.body.rule.id;
      // Wait for async auto-verify to land.
      const deadline = Date.now() + 3000;
      let verified = false;
      while (!verified && Date.now() < deadline) {
        const {
          rows: [r],
        } = await getPool().query<{ destination_verified: boolean }>(
          "SELECT destination_verified FROM rules WHERE id = $1",
          [ruleId],
        );
        verified = r?.destination_verified === true;
        if (!verified) await new Promise((r) => setTimeout(r, 100));
      }
      expect(verified).toBe(true);
    } finally {
      await sink.close();
    }
  });

  it("POST /verify lets the owner re-trigger the handshake", async () => {
    const sink = await makeEchoingSink();
    try {
      const created = await request(app)
        .post(`/api/links/${short}/rules`)
        .set("Cookie", cookie)
        .send({
          type: "threshold",
          config: { count: 1 },
          destination_url: sink.url,
        });
      const ruleId = created.body.rule.id;

      const verify = await request(app)
        .post(`/api/links/${short}/rules/${ruleId}/verify`)
        .set("Cookie", cookie);
      expect(verify.status).toBe(200);
      expect(verify.body.verified).toBe(true);
    } finally {
      await sink.close();
    }
  });

  it("GET firings + POST retry round-trip", async () => {
    const sink = await makeEchoingSink();
    try {
      const created = await request(app)
        .post(`/api/links/${short}/rules`)
        .set("Cookie", cookie)
        .send({
          type: "threshold",
          config: { count: 1 },
          destination_url: sink.url,
        });
      const ruleId = created.body.rule.id;

      // Seed a failed firing directly.
      await getPool().query(
        `INSERT INTO firings(id, rule_id, status, attempts, last_error)
         VALUES('f1', $1, 'failed', 5, 'simulated')`,
        [ruleId],
      );

      const list = await request(app)
        .get(`/api/links/${short}/rules/${ruleId}/firings`)
        .set("Cookie", cookie);
      expect(list.status).toBe(200);
      expect(list.body.firings).toHaveLength(1);
      expect(list.body.firings[0].status).toBe("failed");

      const retry = await request(app)
        .post(`/api/links/${short}/rules/${ruleId}/firings/f1/retry`)
        .set("Cookie", cookie);
      expect(retry.status).toBe(200);
      expect(retry.body.retryJobId).toContain("f1:retry:");

      // Status should have reset.
      const {
        rows: [row],
      } = await getPool().query<{ status: string; attempts: number; last_error: string | null }>(
        "SELECT status, attempts, last_error FROM firings WHERE id='f1'",
      );
      expect(row?.status).toBe("pending");
      expect(row?.attempts).toBe(0);
      expect(row?.last_error).toBeNull();
    } finally {
      await sink.close();
    }
  });

  it("non-owner cannot access firings or trigger retry", async () => {
    await client.query("INSERT INTO auth.users(username, password_hash) VALUES('bob', $1)", [
      await hash("pw"),
    ]);
    const bobLogin = await request(app).post("/login").send({ username: "bob", password: "pw" });
    const bobCookie = sidCookie(bobLogin.headers["set-cookie"]);

    const sink = await makeEchoingSink();
    try {
      const created = await request(app)
        .post(`/api/links/${short}/rules`)
        .set("Cookie", cookie)
        .send({
          type: "threshold",
          config: { count: 1 },
          destination_url: sink.url,
        });
      const ruleId = created.body.rule.id;
      const list = await request(app)
        .get(`/api/links/${short}/rules/${ruleId}/firings`)
        .set("Cookie", bobCookie);
      expect(list.status).toBe(403);
    } finally {
      await sink.close();
    }
  });
});
