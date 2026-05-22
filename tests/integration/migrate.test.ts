import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import { migrate } from "../../src/server/db/migrate.js";

const DATABASE_URL = process.env.DATABASE_URL;

const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("migrate", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query("DROP SCHEMA IF EXISTS auth CASCADE");
    await client.query("DROP TABLE IF EXISTS _migrations");
  });

  afterAll(async () => {
    await client.end();
  });

  it("applies pending migrations and creates auth.users", async () => {
    const result = await migrate(client);
    expect(result.applied).toContain("001_auth_users.sql");

    const { rows } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'auth' AND table_name = 'users'`,
    );
    expect(rows).toHaveLength(1);

    const { rows: idx } = await client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'auth' AND tablename = 'users'`,
    );
    expect(idx.map((r) => r.indexname)).toContain("idx_users_username");
  });

  it("is idempotent on a second run", async () => {
    const first = await migrate(client);
    expect(first.applied.length).toBeGreaterThan(0);

    const second = await migrate(client);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(first.applied);
  });
});
