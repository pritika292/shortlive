import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import pg from "pg";
import { createApp } from "../../src/server/app.js";
import { closePool } from "../../src/server/db/pool.js";
import { resetDb } from "../helpers/db.js";
import { hash } from "../../src/server/services/passwords.js";
import { SESSION_COOKIE } from "../../src/server/routes/auth.js";

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

function sidCookie(setCookie: string[] | string | undefined): string {
  const arr = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const sid = arr.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!sid) throw new Error("no sid cookie set");
  return sid.split(";")[0]!;
}

// Lifecycle invariants the redirect path must hold:
// 1. Custom slugs are unique across all owners.
// 2. The link's own expires_at is enforced.
// 3. The OWNER's expires_at is enforced — even before the sweeper runs.
// 4. Logging out a temp user immediately invalidates their links.
describeIfDb("short-link lifecycle", () => {
  let client: pg.Client;
  const app = createApp();

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

  it("rejects a duplicate custom_short with 409", async () => {
    const first = await request(app).post("/api/quickstart").send({});
    const cookie = sidCookie(first.headers["set-cookie"]);

    const a = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com/a", custom_short: "my-link" });
    expect(a.status).toBe(200);

    const b = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com/b", custom_short: "my-link" });
    expect(b.status).toBe(409);
    expect(b.body.error).toBe("shortcode_taken");
  });

  it("a temp user's link returns 410 once the temp user has expired (before sweeper runs)", async () => {
    const start = await request(app).post("/api/quickstart").send({});
    const cookie = sidCookie(start.headers["set-cookie"]);
    const create = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com/x", custom_short: "owner-test" });
    expect(create.status).toBe(200);

    // While the temp user is alive the link redirects.
    const live = await request(app).get("/owner-test").redirects(0);
    expect(live.status).toBe(302);

    // Force the temp user's expires_at into the past. No sweeper run yet.
    await client.query("UPDATE auth.users SET expires_at = NOW() - interval '1 minute'");

    // Hot path must reject the link immediately, not wait for the sweeper.
    const after = await request(app).get("/owner-test").redirects(0);
    expect(after.status).toBe(404);
  });

  it("logging out a temp user immediately stops their links from resolving", async () => {
    const start = await request(app).post("/api/quickstart").send({});
    const cookie = sidCookie(start.headers["set-cookie"]);
    const create = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com/y", custom_short: "logout-test" });
    expect(create.status).toBe(200);

    const live = await request(app).get("/logout-test").redirects(0);
    expect(live.status).toBe(302);

    await request(app).post("/logout").set("Cookie", cookie);

    // FK cascade should have wiped the link the moment the user was deleted.
    const after = await request(app).get("/logout-test").redirects(0);
    expect(after.status).toBe(404);

    // The temp user row itself should be gone.
    const { rows } = await client.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM auth.users WHERE expires_at IS NOT NULL",
    );
    expect(rows[0]!.n).toBe("0");
  });

  it("a permanent user's logout does NOT delete the user (only the session)", async () => {
    await client.query(
      "INSERT INTO auth.users(username, password_hash, expires_at) VALUES('perm', $1, NULL)",
      [await hash("pw")],
    );
    const login = await request(app).post("/login").send({ username: "perm", password: "pw" });
    const cookie = sidCookie(login.headers["set-cookie"]);

    await request(app).post("/logout").set("Cookie", cookie);

    const { rows } = await client.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM auth.users WHERE username = 'perm'",
    );
    expect(rows[0]!.n).toBe("1");
  });
});
