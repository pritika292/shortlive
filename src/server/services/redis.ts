import Redis from "ioredis";
import { config } from "../config.js";

const RECENT_CLICKS_LIMIT = 100;

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(config().REDIS_URL, { lazyConnect: false });
  }
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}

export function recentClicksKey(short: string): string {
  return `shortlive:recent_clicks:${short}`;
}

export function clicksChannel(short: string): string {
  return `shortlive:clicks.${short}`;
}

export interface ClickEventPayload {
  ts: number;
  country: string | null;
  lat: number | null;
  lon: number | null;
  device: string | null;
  referrer: string | null;
}

export async function recordClickEvent(short: string, payload: ClickEventPayload): Promise<void> {
  const json = JSON.stringify(payload);
  const r = getRedis();
  const key = recentClicksKey(short);
  await r
    .multi()
    .zadd(key, payload.ts, json)
    .zremrangebyrank(key, 0, -RECENT_CLICKS_LIMIT - 1)
    .publish(clicksChannel(short), json)
    .exec();
}

export async function getRecentClicks(
  short: string,
  limit: number = RECENT_CLICKS_LIMIT,
): Promise<ClickEventPayload[]> {
  const r = getRedis();
  const raw = await r.zrevrange(recentClicksKey(short), 0, limit - 1);
  return raw.map((s) => JSON.parse(s) as ClickEventPayload);
}
