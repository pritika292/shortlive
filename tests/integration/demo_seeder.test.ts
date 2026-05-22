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

  it("creates the demo row with 2000 historical clicks spanning ~24h on first run", async () => {
    const result = await seedDemo();
    expect(result.created).toBe(true);
    expect(result.reseeded).toBe(true);
    expect(result.totalClicks).toBe(2000);

    const { rows } = await client.query<{ short: string; target: string; owner_id: string | null }>(
      "SELECT short, target, owner_id FROM urls WHERE short = 'demo'",
    );
    expect(rows[0]?.short).toBe("demo");
    expect(rows[0]?.owner_id).toBeNull();

    // Distinct countries: should be deep enough to show interesting breakdowns.
    const { rows: countryRows } = await client.query<{ c: string }>(
      "SELECT COUNT(DISTINCT country)::text AS c FROM clicks WHERE url_id = (SELECT id FROM urls WHERE short='demo')",
    );
    expect(Number(countryRows[0]!.c)).toBeGreaterThanOrEqual(30);

    // Time spread: oldest click should be > 23h ago.
    const { rows: ageRows } = await client.query<{ hrs: string }>(
      "SELECT EXTRACT(EPOCH FROM (NOW() - MIN(ts)))::text AS hrs FROM clicks WHERE url_id = (SELECT id FROM urls WHERE short='demo')",
    );
    const hoursSpread = Number(ageRows[0]!.hrs) / 3600;
    expect(hoursSpread).toBeGreaterThan(23);

    const zlen = await adminRedis.zcard(recentClicksKey("demo"));
    expect(zlen).toBeGreaterThan(0);

    // Pre-configured demo rules.
    const { rows: rules } = await client.query<{ c: string }>(
      "SELECT COUNT(*)::text AS c FROM rules WHERE url_id = (SELECT id FROM urls WHERE short='demo')",
    );
    expect(Number(rules[0]!.c)).toBe(3);
  });

  it("re-seeds the clicks table on every run, dropping any accumulated junk", async () => {
    await seedDemo();
    // Simulate accumulated null-country pollution that built up on prod.
    await client.query(
      `INSERT INTO clicks(url_id, ts, country)
        SELECT id, NOW(), NULL FROM urls WHERE short = 'demo'`,
    );
    await client.query(
      `INSERT INTO clicks(url_id, ts, country)
        SELECT id, NOW(), NULL FROM urls WHERE short = 'demo'`,
    );
    const result = await seedDemo();
    expect(result.created).toBe(false);
    expect(result.reseeded).toBe(true);
    expect(result.totalClicks).toBe(2000);

    // The junk rows are gone.
    const { rows } = await client.query<{ c: string }>(
      "SELECT COUNT(*)::text AS c FROM clicks WHERE url_id = (SELECT id FROM urls WHERE short = 'demo') AND country IS NULL",
    );
    expect(Number(rows[0]!.c)).toBe(0);
  });

  it("wipes the Redis ZSET on every run", async () => {
    await seedDemo();
    // Pollute Redis with a stale null-country entry.
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

    const raw = await adminRedis.zrange(recentClicksKey("demo"), 0, -1);
    const parsed = raw.map((s) => JSON.parse(s) as { country: string | null });
    // Only synthetic entries with real countries should remain.
    expect(parsed.every((p) => p.country !== null)).toBe(true);
  });
});
