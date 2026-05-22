import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import Redis from "ioredis";
import { resetDb } from "../helpers/db.js";
import { closePool, getPool } from "../../src/server/db/pool.js";
import { closeRedis } from "../../src/server/services/redis.js";
import { drainClickLogs } from "../../src/server/services/click_logger.js";
import { closeWebhookQueue, getWebhookQueue } from "../../src/server/services/queue.js";
import { evaluateRulesForClick } from "../../src/server/services/rule_engine.js";

const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;
const describeIfDeps = DATABASE_URL && REDIS_URL ? describe : describe.skip;

async function insertRule(
  type: string,
  config: Record<string, unknown>,
  urlId: number,
  cooldownSeconds = 0,
): Promise<string> {
  const id = `rule_${Math.random().toString(36).slice(2, 12)}`;
  await getPool().query(
    `INSERT INTO rules(id, url_id, type, config, destination_url,
                      destination_verified, cooldown_seconds, signing_secret)
       VALUES($1, $2, $3, $4, 'https://sink.example/', TRUE, $5, 'secret')`,
    [id, urlId, type, JSON.stringify(config), cooldownSeconds],
  );
  return id;
}

async function fireClick(short: string, urlId: number, country = "US"): Promise<void> {
  await evaluateRulesForClick({
    short,
    click: {
      urlId,
      short,
      ip: "x",
      userAgent: undefined,
      referrer: undefined,
      country,
      device: null,
    },
  });
}

async function firingCount(client: pg.Client): Promise<number> {
  const { rows } = await client.query<{ c: string }>("SELECT COUNT(*)::text AS c FROM firings");
  return Number(rows[0]!.c);
}

describeIfDeps("velocity + cooldowns", () => {
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
      `INSERT INTO urls(short, target, owner_id) VALUES('v1', 'https://x', (SELECT id FROM auth.users WHERE username='owner')) RETURNING id`,
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

  it("fires once the window reaches N and again only after the cooldown lapses", async () => {
    await insertRule(
      "velocity",
      { count: 3, window_seconds: 30 },
      urlId,
      2, // 2-second cooldown
    );

    for (let i = 0; i < 5; i++) await fireClick("v1", urlId);
    expect(await firingCount(client)).toBe(1);

    // Within cooldown — more clicks must not fire.
    for (let i = 0; i < 3; i++) await fireClick("v1", urlId);
    expect(await firingCount(client)).toBe(1);

    // Wait for cooldown to pass, then fire enough to fill the window again.
    await new Promise((r) => setTimeout(r, 2200));
    for (let i = 0; i < 3; i++) await fireClick("v1", urlId);
    expect(await firingCount(client)).toBe(2);
  });

  it("velocity does not fire below the threshold", async () => {
    await insertRule("velocity", { count: 5, window_seconds: 30 }, urlId);
    for (let i = 0; i < 4; i++) await fireClick("v1", urlId);
    expect(await firingCount(client)).toBe(0);
  });

  it("cooldown applies uniformly to threshold rules too", async () => {
    await insertRule("threshold", { count: 1 }, urlId, 2);
    await fireClick("v1", urlId);
    expect(await firingCount(client)).toBe(1);
    await fireClick("v1", urlId);
    expect(await firingCount(client)).toBe(1);
  });
});
