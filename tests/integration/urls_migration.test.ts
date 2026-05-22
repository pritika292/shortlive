import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { resetDb } from "../helpers/db.js";

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("urls migration", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    await client.query("DROP TABLE IF EXISTS urls");
    await resetDb(client);
  });

  afterAll(async () => {
    await client.end();
  });

  it("creates the urls table with the expected columns", async () => {
    const { rows } = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'urls'
       ORDER BY ordinal_position`,
    );
    expect(rows.map((r) => r.column_name)).toEqual([
      "id",
      "short",
      "target",
      "owner_id",
      "expires_at",
      "password_hash",
      "created_at",
      "created_ip_hash",
    ]);
  });

  it("enforces UNIQUE on short", async () => {
    await client.query("INSERT INTO urls(short, target) VALUES('uniq001', 'https://example.com')");
    await expect(
      client.query("INSERT INTO urls(short, target) VALUES('uniq001', 'https://example.com')"),
    ).rejects.toThrow();
  });
});
