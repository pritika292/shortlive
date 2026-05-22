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

  it("creates the demo row with ~300 historical clicks on first run", async () => {
    const result = await seedDemo();
    expect(result.created).toBe(true);
    expect(result.totalClicks).toBe(300);

    const { rows } = await client.query<{ short: string; target: string; owner_id: string | null }>(
      "SELECT short, target, owner_id FROM urls WHERE short = 'demo'",
    );
    expect(rows[0]?.short).toBe("demo");
    expect(rows[0]?.owner_id).toBeNull();

    const zlen = await adminRedis.zcard(recentClicksKey("demo"));
    expect(zlen).toBeGreaterThan(0);
  });

  it("is a no-op on the second run if recent clicks exist", async () => {
    await seedDemo();
    // Insert a fresh click manually so the seeder sees recent activity.
    await client.query(
      `INSERT INTO clicks(url_id, ts) SELECT id, NOW() FROM urls WHERE short = 'demo'`,
    );
    const result = await seedDemo();
    expect(result.created).toBe(false);
    expect(result.toppedUp).toBe(false);
  });

  it("tops up if the most recent click is older than 5 minutes", async () => {
    await seedDemo();
    // Push every click back by 10 minutes.
    await client.query(
      "UPDATE clicks SET ts = ts - INTERVAL '10 minutes' WHERE url_id = (SELECT id FROM urls WHERE short = 'demo')",
    );
    const before = (
      await client.query<{ c: string }>(
        "SELECT COUNT(*)::text AS c FROM clicks WHERE url_id = (SELECT id FROM urls WHERE short = 'demo')",
      )
    ).rows[0]!.c;

    const result = await seedDemo();
    expect(result.created).toBe(false);
    expect(result.toppedUp).toBe(true);

    const after = (
      await client.query<{ c: string }>(
        "SELECT COUNT(*)::text AS c FROM clicks WHERE url_id = (SELECT id FROM urls WHERE short = 'demo')",
      )
    ).rows[0]!.c;
    expect(Number(after)).toBeGreaterThan(Number(before));
  });
});
