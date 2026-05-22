import { getPool } from "../db/pool.js";
import { recordClickEvent } from "../services/redis.js";

const DEMO_SHORT = "demo";
const DEMO_TARGET = "https://en.wikipedia.org/wiki/Distributed_computing";

interface SeedCity {
  country: string;
  lat: number;
  lon: number;
  device: string;
  referrer: string;
  ua: string;
}

const CITIES: SeedCity[] = [
  {
    country: "US",
    lat: 37.7749,
    lon: -122.4194,
    device: "desktop",
    referrer: "https://news.ycombinator.com/",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  },
  {
    country: "US",
    lat: 40.7128,
    lon: -74.006,
    device: "mobile",
    referrer: "https://twitter.com/",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15",
  },
  {
    country: "GB",
    lat: 51.5074,
    lon: -0.1278,
    device: "desktop",
    referrer: "https://www.google.com/",
    ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
  },
  {
    country: "DE",
    lat: 52.52,
    lon: 13.405,
    device: "desktop",
    referrer: "https://lobste.rs/",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  },
  {
    country: "IN",
    lat: 12.9716,
    lon: 77.5946,
    device: "mobile",
    referrer: "https://www.linkedin.com/",
    ua: "Mozilla/5.0 (Linux; Android 14)",
  },
  {
    country: "JP",
    lat: 35.6762,
    lon: 139.6503,
    device: "desktop",
    referrer: "https://news.ycombinator.com/",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  },
  {
    country: "BR",
    lat: -23.5505,
    lon: -46.6333,
    device: "mobile",
    referrer: "",
    ua: "Mozilla/5.0 (Linux; Android 13)",
  },
  {
    country: "AU",
    lat: -33.8688,
    lon: 151.2093,
    device: "desktop",
    referrer: "https://www.reddit.com/",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  },
  {
    country: "CA",
    lat: 43.6532,
    lon: -79.3832,
    device: "desktop",
    referrer: "https://www.google.com/",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  },
  {
    country: "FR",
    lat: 48.8566,
    lon: 2.3522,
    device: "tablet",
    referrer: "https://news.ycombinator.com/",
    ua: "Mozilla/5.0 (iPad; CPU OS 17_0)",
  },
];

function pickCity(rng: () => number): SeedCity {
  const idx = Math.floor(rng() * CITIES.length);
  const c = CITIES[idx] ?? CITIES[0];
  if (!c) throw new Error("CITIES is empty");
  return c;
}

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

async function insertHistoricalClicks(
  id: number,
  count: number,
  fromMsAgo: number,
  rng: () => number,
): Promise<void> {
  // Distribute `count` clicks across the past `fromMsAgo` milliseconds.
  // Newest first so even a partial seed gives recent data.
  const now = Date.now();
  const values: string[] = [];
  const params: unknown[] = [];
  for (let i = 0; i < count; i++) {
    const ts = new Date(now - Math.floor(rng() * fromMsAgo));
    const city = pickCity(rng);
    const p = i * 8;
    values.push(
      `($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5}, $${p + 6}, $${p + 7}, $${p + 8})`,
    );
    params.push(
      id,
      ts,
      city.country,
      city.lat,
      city.lon,
      city.ua,
      city.device,
      city.referrer || null,
    );
  }
  await getPool().query(
    `INSERT INTO clicks(url_id, ts, country, lat, lon, user_agent, device, referrer)
     VALUES ${values.join(", ")}`,
    params,
  );
}

async function topUpRecentRedisClicks(rng: () => number): Promise<void> {
  // Hydrate the ZSET so a fresh dashboard tab has something to render.
  const now = Date.now();
  for (let i = 0; i < 30; i++) {
    const city = pickCity(rng);
    await recordClickEvent(DEMO_SHORT, {
      ts: now - i * 60_000,
      country: city.country,
      lat: city.lat,
      lon: city.lon,
      device: city.device,
      referrer: city.referrer || null,
    });
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
    await insertHistoricalClicks(id, 300, 60 * 60 * 1000, rng);
    await topUpRecentRedisClicks(rng);
    created = true;
  } else {
    // Idempotent top-up: if no clicks in the last 5 min, add a fresh batch.
    const { rows } = await getPool().query<{ recent: string | null }>(
      "SELECT EXTRACT(EPOCH FROM (NOW() - MAX(ts)))::text AS recent FROM clicks WHERE url_id = $1",
      [id],
    );
    const secondsSinceLast = rows[0]?.recent ? Number(rows[0].recent) : Infinity;
    if (!Number.isFinite(secondsSinceLast) || secondsSinceLast > 5 * 60) {
      await insertHistoricalClicks(id, 30, 5 * 60 * 1000, rng);
      await topUpRecentRedisClicks(rng);
      toppedUp = true;
    }
  }

  const { rows: count } = await getPool().query<{ c: string }>(
    "SELECT COUNT(*)::text AS c FROM clicks WHERE url_id = $1",
    [id],
  );
  return { created, toppedUp, totalClicks: Number(count[0]?.c ?? 0) };
}
