import { getPool } from "../db/pool.js";
import { logClick } from "../services/click_logger.js";

const DEMO_SHORT = "demo";
const POLL_INTERVAL_MS = 20_000;
const IDLE_THRESHOLD_MS = 5 * 60_000;

interface SyntheticCity {
  country: string;
  lat: number;
  lon: number;
  device: string;
  referrer: string;
  ua: string;
  ip: string;
}

const CITIES: SyntheticCity[] = [
  {
    country: "US",
    lat: 37.7749,
    lon: -122.4194,
    device: "desktop",
    referrer: "https://news.ycombinator.com/",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    ip: "203.0.113.10",
  },
  {
    country: "US",
    lat: 40.7128,
    lon: -74.006,
    device: "mobile",
    referrer: "https://twitter.com/",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
    ip: "203.0.113.11",
  },
  {
    country: "GB",
    lat: 51.5074,
    lon: -0.1278,
    device: "desktop",
    referrer: "https://www.google.com/",
    ua: "Mozilla/5.0 (X11; Linux x86_64)",
    ip: "203.0.113.12",
  },
  {
    country: "DE",
    lat: 52.52,
    lon: 13.405,
    device: "desktop",
    referrer: "https://lobste.rs/",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    ip: "203.0.113.13",
  },
  {
    country: "IN",
    lat: 12.9716,
    lon: 77.5946,
    device: "mobile",
    referrer: "https://www.linkedin.com/",
    ua: "Mozilla/5.0 (Linux; Android 14)",
    ip: "203.0.113.14",
  },
  {
    country: "JP",
    lat: 35.6762,
    lon: 139.6503,
    device: "desktop",
    referrer: "https://news.ycombinator.com/",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    ip: "203.0.113.15",
  },
  {
    country: "BR",
    lat: -23.5505,
    lon: -46.6333,
    device: "mobile",
    referrer: "",
    ua: "Mozilla/5.0 (Linux; Android 13)",
    ip: "203.0.113.16",
  },
  {
    country: "AU",
    lat: -33.8688,
    lon: 151.2093,
    device: "desktop",
    referrer: "https://www.reddit.com/",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    ip: "203.0.113.17",
  },
  {
    country: "CA",
    lat: 43.6532,
    lon: -79.3832,
    device: "desktop",
    referrer: "https://www.google.com/",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    ip: "203.0.113.18",
  },
  {
    country: "FR",
    lat: 48.8566,
    lon: 2.3522,
    device: "tablet",
    referrer: "https://news.ycombinator.com/",
    ua: "Mozilla/5.0 (iPad; CPU OS 17_0)",
    ip: "203.0.113.19",
  },
];

export function pickSyntheticCity(): SyntheticCity {
  const c = CITIES[Math.floor(Math.random() * CITIES.length)];
  if (!c) throw new Error("CITIES is empty");
  return c;
}

async function urlId(): Promise<number | null> {
  const { rows } = await getPool().query<{ id: string }>("SELECT id FROM urls WHERE short = $1", [
    DEMO_SHORT,
  ]);
  return rows[0] ? Number(rows[0].id) : null;
}

async function secondsSinceLastClick(id: number): Promise<number> {
  const { rows } = await getPool().query<{ recent: string | null }>(
    "SELECT EXTRACT(EPOCH FROM (NOW() - MAX(ts)))::text AS recent FROM clicks WHERE url_id = $1",
    [id],
  );
  const r = rows[0]?.recent;
  return r === null || r === undefined ? Infinity : Number(r);
}

export async function fireSyntheticClicks(urlIdValue: number, count: number): Promise<number> {
  let fired = 0;
  for (let i = 0; i < count; i++) {
    const city = pickSyntheticCity();
    await logClick({
      urlId: urlIdValue,
      short: DEMO_SHORT,
      ip: city.ip,
      userAgent: city.ua,
      referrer: city.referrer || undefined,
    });
    fired++;
  }
  return fired;
}

export interface Simulator {
  stop: () => void;
}

export function startDemoSimulator(): Simulator {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      const id = await urlId();
      if (id === null) return;
      const sinceMs = (await secondsSinceLastClick(id)) * 1000;
      if (sinceMs > IDLE_THRESHOLD_MS) {
        const count = 1 + Math.floor(Math.random() * 3);
        await fireSyntheticClicks(id, count);
      }
    } catch (err) {
      console.error("demo simulator tick failed", err);
    } finally {
      if (!stopped) {
        timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
      }
    }
  };

  timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
