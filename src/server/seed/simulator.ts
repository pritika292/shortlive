import { getPool } from "../db/pool.js";
import { logClick } from "../services/click_logger.js";
import { CITIES, pickCityByContinent, type City } from "./cities.js";

const DEMO_SHORT = "demo";
// Mean interval between simulator ticks; jittered per cycle.
const MEAN_INTERVAL_MS = 30_000;
const MIN_INTERVAL_MS = 10_000;
const MAX_INTERVAL_MS = 90_000;
const IDLE_THRESHOLD_MS = 5 * 60_000;
// 1-in-N ticks are a "burst" — 5-10 clicks at once.
const BURST_INVERSE_PROBABILITY = 5;

export function pickSyntheticCity(): City {
  return pickCityByContinent(Math.random);
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
      referrer: city.referrer ?? undefined,
    });
    fired++;
  }
  return fired;
}

function nextIntervalMs(): number {
  // Poisson-ish jitter: exp-distributed around the mean, clamped.
  const u = Math.random();
  const interval = -Math.log(1 - u) * MEAN_INTERVAL_MS;
  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, interval));
}

function nextBatchSize(): number {
  if (Math.floor(Math.random() * BURST_INVERSE_PROBABILITY) === 0) {
    // Burst: 5-10 clicks at once.
    return 5 + Math.floor(Math.random() * 6);
  }
  // Normal: 1-3 clicks.
  return 1 + Math.floor(Math.random() * 3);
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
        await fireSyntheticClicks(id, nextBatchSize());
      }
    } catch (err) {
      console.error("demo simulator tick failed", err);
    } finally {
      if (!stopped) {
        timer = setTimeout(() => void tick(), nextIntervalMs());
      }
    }
  };

  timer = setTimeout(() => void tick(), nextIntervalMs());
  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}

export { CITIES };
