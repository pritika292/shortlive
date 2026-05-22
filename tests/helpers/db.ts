import pg from "pg";
import { migrate } from "../../src/server/db/migrate.js";
import { drainClickLogs } from "../../src/server/services/click_logger.js";

export async function resetDb(client: pg.ClientBase): Promise<void> {
  await drainClickLogs();
  await client.query("DROP TABLE IF EXISTS clicks CASCADE");
  await client.query("DROP TABLE IF EXISTS urls CASCADE");
  await client.query("DROP TABLE IF EXISTS sessions CASCADE");
  await client.query("DROP SCHEMA IF EXISTS auth CASCADE");
  await client.query("DROP TABLE IF EXISTS _migrations");
  await migrate(client as pg.Client);
}

export async function withClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
