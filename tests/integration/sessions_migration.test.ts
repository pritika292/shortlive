import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { migrate } from "../../src/server/db/migrate.js";

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("sessions migration", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    await client.query("DROP TABLE IF EXISTS sessions");
    await client.query("DROP SCHEMA IF EXISTS auth CASCADE");
    await client.query("DROP TABLE IF EXISTS _migrations");
    await migrate(client);
  });

  afterAll(async () => {
    await client.end();
  });

  it("creates the sessions table with the expected columns", async () => {
    const { rows } = await client.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'sessions'
       ORDER BY ordinal_position`,
    );
    const cols = rows.map((r) => r.column_name);
    expect(cols).toEqual(["sid", "user_id", "created_at", "expires_at", "last_seen"]);
  });

  it("cascades session deletion on user removal", async () => {
    const {
      rows: [u],
    } = await client.query<{ id: string }>(
      `INSERT INTO auth.users(username, password_hash) VALUES('cascade-test', 'x')
       RETURNING id`,
    );
    await client.query(
      `INSERT INTO sessions(sid, user_id, expires_at) VALUES('s-cascade', $1, NOW() + INTERVAL '1 hour')`,
      [u!.id],
    );
    await client.query("DELETE FROM auth.users WHERE id = $1", [u!.id]);
    const { rows: leftover } = await client.query("SELECT 1 FROM sessions WHERE sid = 's-cascade'");
    expect(leftover).toHaveLength(0);
  });
});
