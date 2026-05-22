import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import { createHmac } from "node:crypto";
import pg from "pg";
import Redis from "ioredis";
import { resetDb } from "../helpers/db.js";
import { closePool, getPool } from "../../src/server/db/pool.js";
import { closeRedis } from "../../src/server/services/redis.js";
import { drainClickLogs } from "../../src/server/services/click_logger.js";
import { closeWebhookQueue, getWebhookQueue } from "../../src/server/services/queue.js";
import {
  processDelivery,
  buildPayload,
  startWebhookWorker,
  stopWebhookWorker,
} from "../../src/server/services/webhook_worker.js";
import { evaluateRulesForClick } from "../../src/server/services/rule_engine.js";

const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;
const describeIfDeps = DATABASE_URL && REDIS_URL ? describe : describe.skip;

interface SinkBehavior {
  bodies: string[];
  signatures: string[];
  attemptStatuses: number[];
}

interface Sink {
  behavior: SinkBehavior;
  url: string;
  close: () => Promise<void>;
}

async function makeSink(
  handler: (req: http.IncomingMessage, attempt: number) => { status: number },
): Promise<Sink> {
  const behavior: SinkBehavior = { bodies: [], signatures: [], attemptStatuses: [] };
  let attempt = 0;
  const server = http.createServer((req, res) => {
    attempt += 1;
    let raw = "";
    req.on("data", (c) => (raw += c.toString()));
    req.on("end", () => {
      behavior.bodies.push(raw);
      behavior.signatures.push((req.headers["x-shortlive-signature"] as string) ?? "");
      const out = handler(req, attempt);
      behavior.attemptStatuses.push(out.status);
      res.writeHead(out.status);
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    behavior,
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

async function insertRule(
  urlId: number,
  destinationUrl: string,
  cooldownSeconds = 0,
): Promise<{ id: string; signingSecret: string }> {
  const id = `rule_${Math.random().toString(36).slice(2, 12)}`;
  const signingSecret = "test-secret-32chars-test-secret-32chars";
  await getPool().query(
    `INSERT INTO rules(id, url_id, type, config, destination_url,
                       destination_verified, cooldown_seconds, signing_secret)
       VALUES($1, $2, 'threshold', '{"count":1}', $3, TRUE, $4, $5)`,
    [id, urlId, destinationUrl, cooldownSeconds, signingSecret],
  );
  return { id, signingSecret };
}

async function fireOnce(short: string, urlId: number): Promise<string | null> {
  const out = await evaluateRulesForClick({
    short,
    click: {
      urlId,
      short,
      ip: "x",
      userAgent: undefined,
      referrer: undefined,
      country: "US",
      device: null,
    },
  });
  return out[0]?.firingId ?? null;
}

async function firingStatus(firingId: string): Promise<{
  status: string;
  attempts: number;
  last_response_code: number | null;
  last_error: string | null;
} | null> {
  const { rows } = await getPool().query<{
    status: string;
    attempts: number;
    last_response_code: number | null;
    last_error: string | null;
  }>("SELECT status, attempts, last_response_code, last_error FROM firings WHERE id = $1", [
    firingId,
  ]);
  return rows[0] ?? null;
}

describeIfDeps("webhook worker", () => {
  let client: pg.Client;
  let adminRedis: Redis;
  let urlId: number;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    adminRedis = new Redis(REDIS_URL!);
  });

  beforeEach(async () => {
    await resetDb(client);
    await adminRedis.flushdb();
    await getWebhookQueue().obliterate({ force: true });

    await client.query("INSERT INTO auth.users(username, password_hash) VALUES('owner', 'x')");
    const {
      rows: [u],
    } = await client.query<{ id: string }>(
      `INSERT INTO urls(short, target, owner_id) VALUES('w1', 'https://x', (SELECT id FROM auth.users WHERE username='owner')) RETURNING id`,
    );
    urlId = Number(u!.id);
  });

  afterAll(async () => {
    await drainClickLogs();
    await stopWebhookWorker();
    await closeWebhookQueue();
    await client.end();
    await adminRedis.quit();
    await closeRedis();
    await closePool();
  });

  it("processDelivery POSTs the signed payload and marks the firing delivered on 2xx", async () => {
    const sink = await makeSink(() => ({ status: 200 }));
    try {
      const rule = await insertRule(urlId, sink.url);
      const firingId = await fireOnce("w1", urlId);
      expect(firingId).not.toBeNull();
      const job = await getWebhookQueue().getJob(firingId!);
      expect(job).toBeTruthy();
      await processDelivery(job!);

      expect(sink.behavior.bodies).toHaveLength(1);
      expect(sink.behavior.signatures[0]).toMatch(/^sha256=[0-9a-f]{64}$/);

      // Verify HMAC by recomputing
      const expected = `sha256=${createHmac("sha256", rule.signingSecret).update(sink.behavior.bodies[0]!).digest("hex")}`;
      expect(sink.behavior.signatures[0]).toBe(expected);

      const status = await firingStatus(firingId!);
      expect(status?.status).toBe("delivered");
      expect(status?.last_response_code).toBe(200);
    } finally {
      await sink.close();
    }
  });

  it("throws (forcing BullMQ to retry) on non-2xx and records the attempt", async () => {
    const sink = await makeSink(() => ({ status: 500 }));
    try {
      await insertRule(urlId, sink.url);
      const firingId = await fireOnce("w1", urlId);
      const job = await getWebhookQueue().getJob(firingId!);
      await expect(processDelivery(job!)).rejects.toThrow();

      const status = await firingStatus(firingId!);
      expect(status?.status).toBe("pending");
      expect(status?.last_response_code).toBe(500);
      expect(status?.attempts).toBeGreaterThanOrEqual(1);
    } finally {
      await sink.close();
    }
  });

  it("worker delivers end-to-end with the queue's backoff", async () => {
    const sink = await makeSink((_req, attempt) => ({ status: attempt < 2 ? 500 : 200 }));
    try {
      await insertRule(urlId, sink.url);
      startWebhookWorker();
      const firingId = await fireOnce("w1", urlId);

      // Poll for delivered status (allow time for the 1s backoff).
      const deadline = Date.now() + 15_000;
      let final = await firingStatus(firingId!);
      while (final?.status !== "delivered" && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 200));
        final = await firingStatus(firingId!);
      }
      expect(final?.status).toBe("delivered");
      expect(sink.behavior.bodies.length).toBeGreaterThanOrEqual(2);
    } finally {
      await stopWebhookWorker();
      await sink.close();
    }
  });

  it("buildPayload emits stable JSON with the documented fields", async () => {
    const rule = await insertRule(urlId, "https://noop");
    await fireOnce("w1", urlId);
    const {
      rows: [f],
    } = await getPool().query<{
      firing_id: string;
      rule_id: string;
      rule_enabled: boolean;
      destination_url: string;
      destination_verified: boolean;
      signing_secret: string;
      type: string;
      matched: unknown;
      click_id: string | null;
      click_ts: Date | null;
    }>(
      `SELECT f.id AS firing_id, r.id AS rule_id, r.enabled AS rule_enabled,
              r.destination_url, r.destination_verified, r.signing_secret, r.type,
              f.matched, f.click_id, f.ts AS click_ts
         FROM firings f JOIN rules r ON r.id = f.rule_id`,
    );
    const { body, signature } = buildPayload(f!, "w1");
    const parsed = JSON.parse(body);
    expect(parsed.short).toBe("w1");
    expect(parsed.type).toBe("threshold");
    expect(parsed.firing_id).toBe(f!.firing_id);
    expect(parsed.rule_id).toBe(rule.id);
    expect(signature.startsWith("sha256=")).toBe(true);
  });
});
