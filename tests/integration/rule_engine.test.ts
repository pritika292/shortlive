import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import Redis from "ioredis";
import { resetDb } from "../helpers/db.js";
import { closePool, getPool } from "../../src/server/db/pool.js";
import { closeRedis } from "../../src/server/services/redis.js";
import { drainClickLogs, logClick } from "../../src/server/services/click_logger.js";
import { closeWebhookQueue, getWebhookQueue } from "../../src/server/services/queue.js";

const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;
const describeIfDeps = DATABASE_URL && REDIS_URL ? describe : describe.skip;

async function insertRule(
  type: string,
  config: Record<string, unknown>,
  urlId: number,
  destinationVerified = true,
  cooldownSeconds = 0,
): Promise<string> {
  const id = `rule_${Math.random().toString(36).slice(2, 12)}`;
  await getPool().query(
    `INSERT INTO rules(id, url_id, type, config, destination_url,
                      destination_verified, cooldown_seconds, signing_secret)
       VALUES($1, $2, $3, $4, 'https://sink.example/', $5, $6, 'secret')`,
    [id, urlId, type, JSON.stringify(config), destinationVerified, cooldownSeconds],
  );
  return id;
}

describeIfDeps("rule engine evaluators", () => {
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
    // Drain any BullMQ jobs from prior runs.
    const q = getWebhookQueue();
    await q.obliterate({ force: true });

    await client.query("INSERT INTO auth.users(username, password_hash) VALUES('owner', 'x')");
    const {
      rows: [u],
    } = await client.query<{ id: string }>(
      `INSERT INTO urls(short, target, owner_id) VALUES('t1', 'https://x', (SELECT id FROM auth.users WHERE username='owner')) RETURNING id`,
    );
    urlId = Number(u!.id);
  });

  afterAll(async () => {
    await drainClickLogs();
    await closeWebhookQueue();
    await client.end();
    await adminRedis.quit();
    await closeRedis();
    await closePool();
  });

  it("threshold fires exactly once on the Nth click and enqueues a BullMQ job", async () => {
    await insertRule("threshold", { count: 5 }, urlId);
    for (let i = 0; i < 6; i++) {
      await logClick({
        urlId,
        short: "t1",
        ip: "1.2.3.4",
        userAgent: "ua",
        referrer: undefined,
      });
    }
    const { rows } = await client.query<{ c: string }>("SELECT COUNT(*)::text AS c FROM firings");
    expect(Number(rows[0]!.c)).toBe(1);

    const jobs = await getWebhookQueue().getJobs(["delayed", "waiting", "active", "completed"]);
    expect(jobs.length).toBe(1);
  });

  it("first_of on country fires once per new value", async () => {
    await insertRule("first_of", { dimension: "country" }, urlId);
    // logClick uses geoip on the IP; with no mmdb configured country is null,
    // so use IPs known not to resolve and seed country via a direct insert path.
    // Workaround: fire two distinct synthetic clicks via direct DB inserts.
    // For the rule_engine test we test by calling logClick with IPs that produce
    // null country — should NOT fire. Then we directly invoke evaluateRulesForClick
    // with synthesized contexts to verify the firing behavior.
    const { evaluateRulesForClick } = await import("../../src/server/services/rule_engine.js");
    await evaluateRulesForClick({
      short: "t1",
      click: {
        urlId,
        short: "t1",
        ip: "x",
        userAgent: undefined,
        referrer: undefined,
        country: "US",
        device: null,
      },
    });
    await evaluateRulesForClick({
      short: "t1",
      click: {
        urlId,
        short: "t1",
        ip: "x",
        userAgent: undefined,
        referrer: undefined,
        country: "US",
        device: null,
      },
    });
    await evaluateRulesForClick({
      short: "t1",
      click: {
        urlId,
        short: "t1",
        ip: "x",
        userAgent: undefined,
        referrer: undefined,
        country: "DE",
        device: null,
      },
    });
    const { rows } = await client.query<{ c: string }>("SELECT COUNT(*)::text AS c FROM firings");
    expect(Number(rows[0]!.c)).toBe(2);
  });

  it("per_click fires only on matching clicks", async () => {
    await insertRule("per_click", { filters: { country: ["US"] } }, urlId);
    const { evaluateRulesForClick } = await import("../../src/server/services/rule_engine.js");
    await evaluateRulesForClick({
      short: "t1",
      click: {
        urlId,
        short: "t1",
        ip: "x",
        userAgent: undefined,
        referrer: undefined,
        country: "DE",
        device: null,
      },
    });
    await evaluateRulesForClick({
      short: "t1",
      click: {
        urlId,
        short: "t1",
        ip: "x",
        userAgent: undefined,
        referrer: undefined,
        country: "US",
        device: null,
      },
    });
    await evaluateRulesForClick({
      short: "t1",
      click: {
        urlId,
        short: "t1",
        ip: "x",
        userAgent: undefined,
        referrer: undefined,
        country: "US",
        device: null,
      },
    });
    const { rows } = await client.query<{ c: string }>("SELECT COUNT(*)::text AS c FROM firings");
    expect(Number(rows[0]!.c)).toBe(2);
  });

  it("unverified destination prevents firing", async () => {
    await insertRule("threshold", { count: 1 }, urlId, false);
    const { evaluateRulesForClick } = await import("../../src/server/services/rule_engine.js");
    await evaluateRulesForClick({
      short: "t1",
      click: {
        urlId,
        short: "t1",
        ip: "x",
        userAgent: undefined,
        referrer: undefined,
        country: "US",
        device: null,
      },
    });
    const { rows } = await client.query<{ c: string }>("SELECT COUNT(*)::text AS c FROM firings");
    expect(Number(rows[0]!.c)).toBe(0);
  });

  it("disabled rule does not fire", async () => {
    const id = await insertRule("threshold", { count: 1 }, urlId);
    await client.query("UPDATE rules SET enabled = FALSE WHERE id = $1", [id]);
    const { evaluateRulesForClick } = await import("../../src/server/services/rule_engine.js");
    await evaluateRulesForClick({
      short: "t1",
      click: {
        urlId,
        short: "t1",
        ip: "x",
        userAgent: undefined,
        referrer: undefined,
        country: "US",
        device: null,
      },
    });
    const { rows } = await client.query<{ c: string }>("SELECT COUNT(*)::text AS c FROM firings");
    expect(Number(rows[0]!.c)).toBe(0);
  });
});
