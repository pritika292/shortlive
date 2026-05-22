import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import { resetDb } from "../helpers/db.js";
import { closePool } from "../../src/server/db/pool.js";
import { verify } from "../../src/server/services/passwords.js";
import { seedUser } from "../../scripts/seed-user.js";

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("seed-user CLI", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await resetDb(client);
  });

  afterAll(async () => {
    await client.end();
    await closePool();
  });

  it("inserts a new user with a verifiable password hash", async () => {
    const result = await seedUser(client, {
      username: "test-seed",
      password: "test-password-12345",
      update: false,
    });
    expect(result).toEqual({ inserted: true, updated: false });

    const {
      rows: [row],
    } = await client.query<{ password_hash: string }>(
      "SELECT password_hash FROM auth.users WHERE username = $1",
      ["test-seed"],
    );
    expect(row).toBeDefined();
    expect(await verify("test-password-12345", row!.password_hash)).toBe(true);
    expect(await verify("wrong-password", row!.password_hash)).toBe(false);
  });

  it("is idempotent: second invocation with same username is a no-op", async () => {
    await seedUser(client, { username: "test-seed", password: "first-pw", update: false });
    const first = (
      await client.query<{ password_hash: string }>(
        "SELECT password_hash FROM auth.users WHERE username = $1",
        ["test-seed"],
      )
    ).rows[0]!.password_hash;

    const result = await seedUser(client, {
      username: "test-seed",
      password: "second-pw",
      update: false,
    });
    expect(result).toEqual({ inserted: false, updated: false });

    const second = (
      await client.query<{ password_hash: string }>(
        "SELECT password_hash FROM auth.users WHERE username = $1",
        ["test-seed"],
      )
    ).rows[0]!.password_hash;
    expect(second).toBe(first);
  });

  it("--update overwrites the password hash", async () => {
    await seedUser(client, { username: "test-seed", password: "old-pw", update: false });
    const result = await seedUser(client, {
      username: "test-seed",
      password: "new-pw",
      update: true,
    });
    expect(result).toEqual({ inserted: false, updated: true });

    const {
      rows: [row],
    } = await client.query<{ password_hash: string }>(
      "SELECT password_hash FROM auth.users WHERE username = $1",
      ["test-seed"],
    );
    expect(await verify("new-pw", row!.password_hash)).toBe(true);
    expect(await verify("old-pw", row!.password_hash)).toBe(false);
  });

  it("stores display_name when provided", async () => {
    await seedUser(client, {
      username: "test-seed",
      password: "pw",
      displayName: "Test User",
      update: false,
    });
    const {
      rows: [row],
    } = await client.query<{ display_name: string }>(
      "SELECT display_name FROM auth.users WHERE username = $1",
      ["test-seed"],
    );
    expect(row!.display_name).toBe("Test User");
  });
});
