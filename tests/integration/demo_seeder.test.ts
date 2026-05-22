import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import Redis from "ioredis";
import { resetDb } from "../helpers/db.js";
import { seedDemo } from "../../src/server/seed/demo.js";
import { closePool } from "../../src/server/db/pool.js";
import { closeRedis, recentClicksKey } from "../../src/server/services/redis.js";

const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;
const describeIfDeps = DATABASE_URL && REDIS_URL ? describe : describe.skip;

describeIfDeps("demo seeder", () => {
  let client: pg.Client;
  let adminRedis: Redis;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    adminRedis = new Redis(REDIS_URL!);
  });

  beforeEach(async () => {
    await resetDb(client);
    await adminRedis.flushdb();
  });

  afterAll(async () => {
    await client.end();
    await adminRedis.quit();
    await closeRedis();
    await closePool();
  });

  it("creates the demo URL row and seeds the rules on first run", async () => {
    const result = await seedDemo();
    expect(result.created).toBe(true);
    expect(result.reseeded).toBe(true);

    const { rows } = await client.query<{ short: string; target: string; owner_id: string | null }>(
      "SELECT short, target, owner_id FROM urls WHERE short = 'demo'",
    );
    expect(rows[0]?.short).toBe("demo");
    expect(rows[0]?.owner_id).toBeNull();

    // No historical clicks: the /demo dashboard runs entirely client-side now
    // so the server doesn't need to persist any synthetic rows.
    expect(result.totalClicks).toBe(0);
    const { rows: count } = await client.query<{ c: string }>(
      "SELECT COUNT(*)::text AS c FROM clicks WHERE url_id = (SELECT id FROM urls WHERE short='demo')",
    );
    expect(Number(count[0]!.c)).toBe(0);

    // Pre-configured demo rules still seeded so the rules tab has content.
    const { rows: rules } = await client.query<{ c: string }>(
      "SELECT COUNT(*)::text AS c FROM rules WHERE url_id = (SELECT id FROM urls WHERE short='demo')",
    );
    expect(Number(rules[0]!.c)).toBe(3);
  });

  it("wipes any historical clicks left over from a previous deploy on every run", async () => {
    await seedDemo();
    // Simulate accumulated junk from an earlier deploy.
    await client.query(
      `INSERT INTO clicks(url_id, ts, country)
        SELECT id, NOW(), 'US' FROM urls WHERE short = 'demo'`,
    );
    await client.query(
      `INSERT INTO clicks(url_id, ts, country)
        SELECT id, NOW(), NULL FROM urls WHERE short = 'demo'`,
    );

    const result = await seedDemo();
    expect(result.created).toBe(false);
    expect(result.totalClicks).toBe(0);

    const { rows } = await client.query<{ c: string }>(
      "SELECT COUNT(*)::text AS c FROM clicks WHERE url_id = (SELECT id FROM urls WHERE short = 'demo')",
    );
    expect(Number(rows[0]!.c)).toBe(0);
  });

  it("wipes the Redis ZSET on every run", async () => {
    await seedDemo();
    await adminRedis.zadd(
      recentClicksKey("demo"),
      Date.now(),
      JSON.stringify({
        ts: Date.now(),
        country: null,
        lat: null,
        lon: null,
        device: null,
        referrer: null,
      }),
    );

    await seedDemo();

    const zlen = await adminRedis.zcard(recentClicksKey("demo"));
    expect(zlen).toBe(0);
  });
});
