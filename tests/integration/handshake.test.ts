import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import pg from "pg";
import { resetDb } from "../helpers/db.js";
import { closePool, getPool } from "../../src/server/db/pool.js";
import { performHandshake, verifyRuleDestination } from "../../src/server/services/handshake.js";

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

interface SinkHandle {
  url: string;
  close: () => Promise<void>;
}

async function makeSink(handler: http.RequestListener): Promise<SinkHandle> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

describeIfDb("destination handshake", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await resetDb(client);
    await client.query("INSERT INTO auth.users(username, password_hash) VALUES('owner', 'x')");
    await client.query(
      `INSERT INTO urls(short, target, owner_id) VALUES('h1', 'https://x', (SELECT id FROM auth.users WHERE username='owner'))`,
    );
  });

  afterAll(async () => {
    await client.end();
    await closePool();
  });

  it("verifies an echoing sink", async () => {
    const sink = await makeSink((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c.toString()));
      req.on("end", () => {
        const j = JSON.parse(body) as { verification_nonce: string };
        res.setHeader("Content-Type", "application/json");
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, nonce: j.verification_nonce }));
      });
    });
    try {
      const out = await performHandshake(sink.url);
      expect(out.verified).toBe(true);
      expect(out.status).toBe(200);
    } finally {
      await sink.close();
    }
  });

  it("rejects a non-echoing sink", async () => {
    const sink = await makeSink((_req, res) => {
      res.writeHead(200);
      res.end("ok");
    });
    try {
      const out = await performHandshake(sink.url);
      expect(out.verified).toBe(false);
      expect(out.error).toMatch(/nonce not echoed/);
    } finally {
      await sink.close();
    }
  });

  it("records destination_verified + verification_attempts on a rule", async () => {
    const sink = await makeSink((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c.toString()));
      req.on("end", () => {
        const j = JSON.parse(body) as { verification_nonce: string };
        res.writeHead(200);
        res.end(j.verification_nonce);
      });
    });
    try {
      await getPool().query(
        `INSERT INTO rules(id, url_id, type, config, destination_url, signing_secret)
         VALUES('r1', (SELECT id FROM urls WHERE short='h1'), 'threshold', '{"count":1}', $1, 'secret')`,
        [sink.url],
      );
      const out = await verifyRuleDestination("r1");
      expect(out.verified).toBe(true);
      const {
        rows: [row],
      } = await client.query<{
        destination_verified: boolean;
        verification_attempts: number;
        last_verification_error: string | null;
      }>(
        "SELECT destination_verified, verification_attempts, last_verification_error FROM rules WHERE id='r1'",
      );
      expect(row?.destination_verified).toBe(true);
      expect(row?.verification_attempts).toBe(1);
      expect(row?.last_verification_error).toBeNull();
    } finally {
      await sink.close();
    }
  });

  it("records last_verification_error on a 500", async () => {
    const sink = await makeSink((_req, res) => {
      res.writeHead(500);
      res.end("boom");
    });
    try {
      await getPool().query(
        `INSERT INTO rules(id, url_id, type, config, destination_url, signing_secret)
         VALUES('r2', (SELECT id FROM urls WHERE short='h1'), 'threshold', '{"count":1}', $1, 'secret')`,
        [sink.url],
      );
      const out = await verifyRuleDestination("r2");
      expect(out.verified).toBe(false);
      const {
        rows: [row],
      } = await client.query<{ destination_verified: boolean; last_verification_error: string }>(
        "SELECT destination_verified, last_verification_error FROM rules WHERE id='r2'",
      );
      expect(row?.destination_verified).toBe(false);
      expect(row?.last_verification_error).toMatch(/HTTP 500/);
    } finally {
      await sink.close();
    }
  });
});
