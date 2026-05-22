import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import request from "supertest";
import { WebSocket } from "ws";
import Redis from "ioredis";
import pg from "pg";
import { createApp } from "../../src/server/app.js";
import { hash } from "../../src/server/services/passwords.js";
import { resetDb } from "../helpers/db.js";
import { closePool } from "../../src/server/db/pool.js";
import { closeRedis, recordClickEvent } from "../../src/server/services/redis.js";
import { drainClickLogs } from "../../src/server/services/click_logger.js";
import { attachWebSocketServer } from "../../src/server/ws/server.js";

const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;
const describeIfDeps = DATABASE_URL && REDIS_URL ? describe : describe.skip;

function sidCookie(setCookie: string[] | string | undefined): string {
  const arr = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const sid = arr.find((c) => c.startsWith("sid="));
  if (!sid) throw new Error("no sid cookie set");
  return sid.split(";")[0]!;
}

function waitForMessage(ws: WebSocket, timeoutMs = 1000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ws message timeout")), timeoutMs);
    ws.once("message", (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
  });
}

describeIfDeps("websocket fan-out", () => {
  let client: pg.Client;
  let adminRedis: Redis;
  let server: http.Server;
  let port: number;
  let cookie: string;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    adminRedis = new Redis(REDIS_URL!);
    server = http.createServer(createApp());
    attachWebSocketServer(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (typeof addr === "object" && addr) port = addr.port;
  });

  beforeEach(async () => {
    await resetDb(client);
    await adminRedis.flushdb();
    await client.query("INSERT INTO auth.users(username, password_hash) VALUES('alice', $1)", [
      await hash("pw"),
    ]);
    const login = await request(server).post("/login").send({ username: "alice", password: "pw" });
    cookie = sidCookie(login.headers["set-cookie"]);
  });

  const openSockets: WebSocket[] = [];

  afterEach(() => {
    for (const ws of openSockets) ws.close();
    openSockets.length = 0;
  });

  afterAll(async () => {
    await drainClickLogs();
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    await client.end();
    await adminRedis.quit();
    await closeRedis();
    await closePool();
  });

  it("sends a hydration burst from the ZSET on connect", async () => {
    const short = "wshydr1";
    await request(server)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com", custom_short: short });
    for (let i = 0; i < 3; i++) {
      await recordClickEvent(short, {
        ts: 1_000 + i,
        country: "US",
        lat: null,
        lon: null,
        device: null,
        referrer: null,
      });
    }

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/${short}`);
    openSockets.push(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });
    const msg = (await waitForMessage(ws)) as { type: string; clicks: { ts: number }[] };
    expect(msg.type).toBe("hydration");
    expect(msg.clicks).toHaveLength(3);
    expect(msg.clicks[0]!.ts).toBe(1002);
  });

  it("delivers a live click event after a POST/GET round trip", async () => {
    const short = "wslive1";
    await request(server)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com", custom_short: short });

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/${short}`);
    openSockets.push(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });
    await waitForMessage(ws);

    const messagePromise = waitForMessage(ws);
    await request(server).get(`/${short}`);
    const live = (await messagePromise) as { type: string; click: { ts: number } };
    expect(live.type).toBe("click");
    expect(typeof live.click.ts).toBe("number");
  });

  it("rejects WS to an unknown short with close code 1008", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/missing`);
    openSockets.push(ws);
    const closeCode = await new Promise<number>((resolve, reject) => {
      ws.once("close", (code) => resolve(code));
      ws.once("error", reject);
    });
    expect(closeCode).toBe(1008);
  });

  it("rejects WS to a malformed path with 404 (no upgrade)", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/wrongprefix/abc`);
    openSockets.push(ws);
    const err = await new Promise<Error>((resolve) => ws.once("error", resolve));
    expect(err.message).toMatch(/unexpected server response|404/i);
  });
});
