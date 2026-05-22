// Static seed for the client-side demo dashboard. Hand-tuned so the first
// paint never looks empty, even before the user presses "Start demo".
// Distribution matches the curated country list and the existing CITIES mix
// roughly enough that the breakdown cards look organic.

import type { ClickEvent } from "../hooks/useShortliveClicks.js";

interface CityEntry {
  country: string;
  lat: number;
  lon: number;
  // Sampling weight relative to the total. Higher = appears more often.
  weight: number;
}

// 10 curated countries, weighted to look like a real distribution dominated
// by the US with a long tail.
export const DEMO_CITIES: CityEntry[] = [
  { country: "US", lat: 37.7749, lon: -122.4194, weight: 8 }, // SF
  { country: "US", lat: 40.7128, lon: -74.006, weight: 6 }, // NYC
  { country: "US", lat: 47.6062, lon: -122.3321, weight: 4 }, // Seattle
  { country: "US", lat: 42.3601, lon: -71.0589, weight: 3 }, // Boston
  { country: "GB", lat: 51.5074, lon: -0.1278, weight: 5 }, // London
  { country: "DE", lat: 52.52, lon: 13.405, weight: 4 }, // Berlin
  { country: "IN", lat: 12.9716, lon: 77.5946, weight: 5 }, // Bengaluru
  { country: "IN", lat: 19.076, lon: 72.8777, weight: 3 }, // Mumbai
  { country: "JP", lat: 35.6762, lon: 139.6503, weight: 4 }, // Tokyo
  { country: "CA", lat: 43.6532, lon: -79.3832, weight: 3 }, // Toronto
  { country: "BR", lat: -23.5505, lon: -46.6333, weight: 3 }, // Sao Paulo
  { country: "AU", lat: -33.8688, lon: 151.2093, weight: 2 }, // Sydney
  { country: "MX", lat: 19.4326, lon: -99.1332, weight: 2 }, // Mexico City
  { country: "ZA", lat: -26.2041, lon: 28.0473, weight: 2 }, // Johannesburg
];

const DEVICES: ClickEvent["device"][] = [
  "desktop",
  "desktop",
  "desktop",
  "mobile",
  "mobile",
  "tablet",
];
const REFERRERS: (string | null)[] = [
  "https://news.ycombinator.com/",
  "https://x.com/",
  "https://www.reddit.com/",
  "https://www.linkedin.com/",
  "https://github.com/",
  "https://www.google.com/",
  null,
  null,
];

const TOTAL_WEIGHT = DEMO_CITIES.reduce((s, c) => s + c.weight, 0);

export function pickDemoCity(rng: () => number = Math.random): CityEntry {
  const r = rng() * TOTAL_WEIGHT;
  let acc = 0;
  for (const c of DEMO_CITIES) {
    acc += c.weight;
    if (r <= acc) return c;
  }
  const fallback = DEMO_CITIES[0];
  if (!fallback) throw new Error("DEMO_CITIES is empty");
  return fallback;
}

function pick<T>(arr: T[], rng: () => number): T {
  const value = arr[Math.floor(rng() * arr.length)];
  if (value === undefined) throw new Error("pick from empty array");
  return value;
}

// Build N synthetic clicks spread evenly over the last `windowMs` for the
// initial page state. Deterministic via a simple LCG so the page always
// renders the same dataset on first paint (no flicker between SSR-ish loads).
export function buildSeedClicks(count: number, windowMs: number, seed = 42): ClickEvent[] {
  let s = seed >>> 0;
  const rng = (): number => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const now = Date.now();
  const events: ClickEvent[] = [];
  for (let i = 0; i < count; i++) {
    const city = pickDemoCity(rng);
    events.push({
      ts: now - Math.floor(rng() * windowMs),
      country: city.country,
      lat: city.lat,
      lon: city.lon,
      device: pick(DEVICES, rng),
      referrer: pick(REFERRERS, rng),
    });
  }
  // Newest first for the recent-feed.
  events.sort((a, b) => b.ts - a.ts);
  return events;
}

// One fresh synthetic click `now`. Used by the simulator while running.
export function makeLiveClick(now = Date.now(), rng: () => number = Math.random): ClickEvent {
  const city = pickDemoCity(rng);
  return {
    ts: now,
    country: city.country,
    lat: city.lat,
    lon: city.lon,
    device: pick(DEVICES, rng),
    referrer: pick(REFERRERS, rng),
  };
}
