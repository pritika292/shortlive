import { getPool } from "../db/pool.js";
import { recordClickEvent } from "../services/redis.js";
import { CITIES, pickCityByContinent, pickHour, type City } from "./cities.js";

const DEMO_SHORT = "demo";
const DEMO_TARGET = "https://en.wikipedia.org/wiki/Distributed_computing";

// Re-export for the simulator + tests.
export { CITIES };
export type { City };

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function urlId(): Promise<number | null> {
  const { rows } = await getPool().query<{ id: string }>("SELECT id FROM urls WHERE short = $1", [
    DEMO_SHORT,
  ]);
  return rows[0] ? Number(rows[0].id) : null;
}

function pickTimestampInLastHours(rng: () => number, hours: number, now: number): Date {
  // Bias toward business-hour peaks via the hourly weight function. Pick a
  // random day-offset within the window first, then pick an hour from the
  // weighted distribution, then jitter the minutes uniformly.
  const days = Math.floor(rng() * Math.max(1, Math.ceil(hours / 24)));
  const hour = pickHour(rng);
  const minute = Math.floor(rng() * 60);
  const second = Math.floor(rng() * 60);
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, minute, second, 0);
  // If we landed in the future (because we randomly picked a future hour
  // today), shift back one day.
  if (d.getTime() > now) d.setUTCDate(d.getUTCDate() - 1);
  // Don't go further back than the window.
  const cutoff = now - hours * 60 * 60 * 1000;
  if (d.getTime() < cutoff) return new Date(cutoff + rng() * (now - cutoff));
  return d;
}

async function insertHistoricalClicks(
  id: number,
  count: number,
  hours: number,
  rng: () => number,
): Promise<void> {
  const now = Date.now();
  const values: string[] = [];
  const params: unknown[] = [];
  for (let i = 0; i < count; i++) {
    const ts = pickTimestampInLastHours(rng, hours, now);
    const city = pickCityByContinent(rng);
    const p = i * 8;
    values.push(
      `($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5}, $${p + 6}, $${p + 7}, $${p + 8})`,
    );
    params.push(id, ts, city.country, city.lat, city.lon, city.ua, city.device, city.referrer);
  }
  await getPool().query(
    `INSERT INTO clicks(url_id, ts, country, lat, lon, user_agent, device, referrer)
     VALUES ${values.join(", ")}`,
    params,
  );
}

async function topUpRecentRedisClicks(rng: () => number): Promise<void> {
  const now = Date.now();
  // Fresh ZSET entries spread across the last hour so a new dashboard tab
  // has the most-recent 30 immediately.
  for (let i = 0; i < 30; i++) {
    const city = pickCityByContinent(rng);
    await recordClickEvent(DEMO_SHORT, {
      ts: now - i * 60_000,
      country: city.country,
      lat: city.lat,
      lon: city.lon,
      device: city.device,
      referrer: city.referrer,
    });
  }
}

interface DemoRuleSeed {
  id: string;
  type: "threshold" | "velocity" | "first_of";
  config: Record<string, unknown>;
  destinationUrl: string;
  cooldownSeconds: number;
}

const DEMO_RULES: DemoRuleSeed[] = [
  {
    id: "demo-threshold",
    type: "threshold",
    config: { count: 500 },
    destinationUrl: "https://webhook.site/00000000-demo-threshold",
    cooldownSeconds: 0,
  },
  {
    id: "demo-velocity",
    type: "velocity",
    config: { count: 50, window_seconds: 60 },
    destinationUrl: "https://webhook.site/00000000-demo-velocity",
    cooldownSeconds: 300,
  },
  {
    id: "demo-first-of-country",
    type: "first_of",
    config: { dimension: "country" },
    destinationUrl: "https://webhook.site/00000000-demo-first-of",
    cooldownSeconds: 0,
  },
];

async function seedDemoRules(urlIdValue: number): Promise<void> {
  for (const r of DEMO_RULES) {
    await getPool().query(
      `INSERT INTO rules(id, url_id, type, config, destination_url,
                         destination_verified, cooldown_seconds, signing_secret)
       VALUES($1, $2, $3, $4, $5, FALSE, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        r.id,
        urlIdValue,
        r.type,
        JSON.stringify(r.config),
        r.destinationUrl,
        r.cooldownSeconds,
        "demo-placeholder-signing-secret",
      ],
    );
  }
}

export interface SeedResult {
  created: boolean;
  toppedUp: boolean;
  totalClicks: number;
}

export async function seedDemo(): Promise<SeedResult> {
  let id = await urlId();
  const rng = mulberry32(42);
  let created = false;
  let toppedUp = false;

  if (id === null) {
    const { rows } = await getPool().query<{ id: string }>(
      `INSERT INTO urls(short, target, owner_id) VALUES($1, $2, NULL) RETURNING id`,
      [DEMO_SHORT, DEMO_TARGET],
    );
    const inserted = rows[0];
    if (!inserted) throw new Error("demo INSERT returned no row");
    id = Number(inserted.id);
    // 2000 clicks across the past 24h with peak-hour weighting.
    await insertHistoricalClicks(id, 2000, 24, rng);
    await topUpRecentRedisClicks(rng);
    await seedDemoRules(id);
    created = true;
  } else {
    const { rows } = await getPool().query<{ recent: string | null }>(
      "SELECT EXTRACT(EPOCH FROM (NOW() - MAX(ts)))::text AS recent FROM clicks WHERE url_id = $1",
      [id],
    );
    const secondsSinceLast = rows[0]?.recent ? Number(rows[0].recent) : Infinity;
    if (!Number.isFinite(secondsSinceLast) || secondsSinceLast > 5 * 60) {
      // Top-up batch: 50 clicks spread over the last 5 minutes (so the chart
      // ticks visibly on the current bucket without skewing history).
      await insertHistoricalClicks(id, 50, 5 / 60, rng);
      await topUpRecentRedisClicks(rng);
      toppedUp = true;
    }
    // Always (re-)seed the demo rules in case they were deleted manually.
    await seedDemoRules(id);
  }

  const { rows: count } = await getPool().query<{ c: string }>(
    "SELECT COUNT(*)::text AS c FROM clicks WHERE url_id = $1",
    [id],
  );
  return { created, toppedUp, totalClicks: Number(count[0]?.c ?? 0) };
}
