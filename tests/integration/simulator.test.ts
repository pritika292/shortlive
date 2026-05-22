import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import Redis from "ioredis";
import { resetDb } from "../helpers/db.js";
import { seedDemo } from "../../src/server/seed/demo.js";
import { fireSyntheticClicks } from "../../src/server/seed/simulator.js";
import { closePool } from "../../src/server/db/pool.js";
import { closeRedis } from "../../src/server/services/redis.js";
import { drainClickLogs } from "../../src/server/services/click_logger.js";

const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;
const describeIfDeps = DATABASE_URL && REDIS_URL ? describe : describe.skip;

describeIfDeps("demo simulator fireSyntheticClicks", () => {
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
    await seedDemo();
  });

  afterAll(async () => {
    await drainClickLogs();
    await client.end();
    await adminRedis.quit();
    await closeRedis();
    await closePool();
  });

  it("inserts synthetic clicks attributed to the demo url", async () => {
    const {
      rows: [u],
    } = await client.query<{ id: string }>("SELECT id FROM urls WHERE short = 'demo'");
    const id = Number(u!.id);

    const before = (
      await client.query<{ c: string }>(
        "SELECT COUNT(*)::text AS c FROM clicks WHERE url_id = $1",
        [id],
      )
    ).rows[0]!.c;

    await fireSyntheticClicks(id, 3);

    const after = (
      await client.query<{ c: string }>(
        "SELECT COUNT(*)::text AS c FROM clicks WHERE url_id = $1",
        [id],
      )
    ).rows[0]!.c;

    expect(Number(after) - Number(before)).toBe(3);
  });
});
