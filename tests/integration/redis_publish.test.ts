import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import Redis from "ioredis";
import pg from "pg";
import { createApp } from "../../src/server/app.js";
import { hash } from "../../src/server/services/passwords.js";
import { resetDb } from "../helpers/db.js";
import { closePool } from "../../src/server/db/pool.js";
import {
  recentClicksKey,
  clicksChannel,
  closeRedis,
  recordClickEvent,
  getRecentClicks,
  type ClickEventPayload,
} from "../../src/server/services/redis.js";
import { drainClickLogs } from "../../src/server/services/click_logger.js";

const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;
const describeIfDeps = DATABASE_URL && REDIS_URL ? describe : describe.skip;

function sidCookie(setCookie: string[] | string | undefined): string {
  const arr = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const sid = arr.find((c) => c.startsWith("sid="));
  if (!sid) throw new Error("no sid cookie set");
  return sid.split(";")[0]!;
}

describeIfDeps("redis ZSET + pub/sub on click", () => {
  let client: pg.Client;
  let adminRedis: Redis;
  const app = createApp();
  let cookie: string;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    adminRedis = new Redis(REDIS_URL!);
  });

  beforeEach(async () => {
    await resetDb(client);
    await adminRedis.flushdb();
    await client.query("INSERT INTO auth.users(username, password_hash) VALUES('alice', $1)", [
      await hash("pw"),
    ]);
    const login = await request(app).post("/login").send({ username: "alice", password: "pw" });
    cookie = sidCookie(login.headers["set-cookie"]);
  });

  afterAll(async () => {
    await drainClickLogs();
    await client.end();
    await adminRedis.quit();
    await closeRedis();
    await closePool();
  });

  it("ZADDs the click + caps the set at 100", async () => {
    const short = "zsetcap";
    const create = await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com", custom_short: short });
    expect(create.status).toBe(200);

    // Manually record 105 events to assert the cap (cheaper than 105 HTTP hits).
    for (let i = 0; i < 105; i++) {
      await recordClickEvent(short, {
        ts: 1_700_000_000_000 + i,
        country: null,
        lat: null,
        lon: null,
        device: null,
        referrer: null,
      });
    }
    const len = await adminRedis.zcard(recentClicksKey(short));
    expect(len).toBe(100);

    // The lowest score should be from the 6th insert (0..4 were evicted).
    const lowest = await adminRedis.zrange(recentClicksKey(short), 0, 0, "WITHSCORES");
    expect(Number(lowest[1])).toBe(1_700_000_000_000 + 5);
  });

  it("PUBLISHes a JSON message a subscriber receives", async () => {
    const short = "pubsub1";
    await request(app)
      .post("/shorten")
      .set("Cookie", cookie)
      .send({ target: "https://example.com", custom_short: short });

    const subscriber = new Redis(REDIS_URL!);
    const received: string[] = [];
    await subscriber.subscribe(clicksChannel(short));
    subscriber.on("message", (_chan, msg) => {
      received.push(msg);
    });

    await request(app).get(`/${short}`);
    await drainClickLogs();
    // Give the subscriber a tick to receive
    await new Promise((r) => setTimeout(r, 50));

    expect(received).toHaveLength(1);
    const parsed = JSON.parse(received[0]!) as ClickEventPayload;
    expect(typeof parsed.ts).toBe("number");

    await subscriber.quit();
  });

  it("getRecentClicks returns newest-first", async () => {
    const short = "newest1";
    await recordClickEvent(short, {
      ts: 1000,
      country: null,
      lat: null,
      lon: null,
      device: null,
      referrer: null,
    });
    await recordClickEvent(short, {
      ts: 2000,
      country: null,
      lat: null,
      lon: null,
      device: null,
      referrer: null,
    });
    await recordClickEvent(short, {
      ts: 1500,
      country: null,
      lat: null,
      lon: null,
      device: null,
      referrer: null,
    });
    const recent = await getRecentClicks(short);
    expect(recent.map((c) => c.ts)).toEqual([2000, 1500, 1000]);
  });
});
