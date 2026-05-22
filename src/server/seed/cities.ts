// Shared synthetic-city table used by both the demo seeder (historical clicks
// at startup) and the simulator (ongoing trickle). Weights bias the
// distribution toward US + EU + SE Asia hubs without making smaller regions
// invisible.

export interface City {
  country: string;
  lat: number;
  lon: number;
  device: "desktop" | "mobile" | "tablet";
  referrer: string | null;
  ua: string;
  ip: string;
  // Continent code, used by the map filter later. Kept here so cities have a
  // single source of truth.
  continent: "NA" | "EU" | "AS" | "SA" | "AF" | "OC";
}

const UAS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/121.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.2 Safari/605.1.15",
];

function ua(i: number): string {
  // UAS is a non-empty constant array; the modulo lookup is always defined.
  const value = UAS[i % UAS.length];
  if (!value) throw new Error("UAS table is empty");
  return value;
}

// Pre-pick referrers per row so the breakdown looks varied. NULL = direct.
const REF_HN = "https://news.ycombinator.com/";
const REF_X = "https://x.com/";
const REF_TW = "https://twitter.com/";
const REF_RD = "https://www.reddit.com/";
const REF_LI = "https://www.linkedin.com/";
const REF_GO = "https://www.google.com/";
const REF_LB = "https://lobste.rs/";
const REF_GH = "https://github.com/";
const REF_DEV = "https://dev.to/";
const REF_MAS = "https://mastodon.social/";
const REF_BSK = "https://bsky.app/";

export const CITIES: City[] = [
  // North America (~25%)
  {
    country: "US",
    continent: "NA",
    lat: 37.7749,
    lon: -122.4194,
    device: "desktop",
    referrer: REF_HN,
    ua: ua(0),
    ip: "203.0.113.10",
  },
  {
    country: "US",
    continent: "NA",
    lat: 40.7128,
    lon: -74.006,
    device: "mobile",
    referrer: REF_X,
    ua: ua(3),
    ip: "203.0.113.11",
  },
  {
    country: "US",
    continent: "NA",
    lat: 47.6062,
    lon: -122.3321,
    device: "desktop",
    referrer: REF_GH,
    ua: ua(1),
    ip: "203.0.113.12",
  },
  {
    country: "US",
    continent: "NA",
    lat: 30.2672,
    lon: -97.7431,
    device: "desktop",
    referrer: REF_LB,
    ua: ua(2),
    ip: "203.0.113.13",
  },
  {
    country: "US",
    continent: "NA",
    lat: 41.8781,
    lon: -87.6298,
    device: "mobile",
    referrer: REF_TW,
    ua: ua(3),
    ip: "203.0.113.14",
  },
  {
    country: "US",
    continent: "NA",
    lat: 34.0522,
    lon: -118.2437,
    device: "desktop",
    referrer: REF_RD,
    ua: ua(0),
    ip: "203.0.113.15",
  },
  {
    country: "US",
    continent: "NA",
    lat: 42.3601,
    lon: -71.0589,
    device: "desktop",
    referrer: REF_HN,
    ua: ua(6),
    ip: "203.0.113.16",
  },
  {
    country: "US",
    continent: "NA",
    lat: 32.7767,
    lon: -96.797,
    device: "mobile",
    referrer: null,
    ua: ua(4),
    ip: "203.0.113.17",
  },
  {
    country: "CA",
    continent: "NA",
    lat: 43.6532,
    lon: -79.3832,
    device: "desktop",
    referrer: REF_GO,
    ua: ua(0),
    ip: "203.0.113.18",
  },
  {
    country: "CA",
    continent: "NA",
    lat: 49.2827,
    lon: -123.1207,
    device: "tablet",
    referrer: REF_HN,
    ua: ua(5),
    ip: "203.0.113.19",
  },
  {
    country: "MX",
    continent: "NA",
    lat: 19.4326,
    lon: -99.1332,
    device: "mobile",
    referrer: REF_LI,
    ua: ua(4),
    ip: "203.0.113.20",
  },

  // Europe (~20%)
  {
    country: "GB",
    continent: "EU",
    lat: 51.5074,
    lon: -0.1278,
    device: "desktop",
    referrer: REF_GO,
    ua: ua(2),
    ip: "203.0.113.30",
  },
  {
    country: "GB",
    continent: "EU",
    lat: 53.4808,
    lon: -2.2426,
    device: "mobile",
    referrer: REF_RD,
    ua: ua(4),
    ip: "203.0.113.31",
  },
  {
    country: "DE",
    continent: "EU",
    lat: 52.52,
    lon: 13.405,
    device: "desktop",
    referrer: REF_LB,
    ua: ua(1),
    ip: "203.0.113.32",
  },
  {
    country: "DE",
    continent: "EU",
    lat: 50.1109,
    lon: 8.6821,
    device: "desktop",
    referrer: REF_HN,
    ua: ua(1),
    ip: "203.0.113.33",
  },
  {
    country: "FR",
    continent: "EU",
    lat: 48.8566,
    lon: 2.3522,
    device: "tablet",
    referrer: REF_TW,
    ua: ua(5),
    ip: "203.0.113.34",
  },
  {
    country: "NL",
    continent: "EU",
    lat: 52.3676,
    lon: 4.9041,
    device: "desktop",
    referrer: REF_GH,
    ua: ua(2),
    ip: "203.0.113.35",
  },
  {
    country: "ES",
    continent: "EU",
    lat: 40.4168,
    lon: -3.7038,
    device: "mobile",
    referrer: REF_X,
    ua: ua(3),
    ip: "203.0.113.36",
  },
  {
    country: "IT",
    continent: "EU",
    lat: 41.9028,
    lon: 12.4964,
    device: "desktop",
    referrer: REF_GO,
    ua: ua(0),
    ip: "203.0.113.37",
  },
  {
    country: "SE",
    continent: "EU",
    lat: 59.3293,
    lon: 18.0686,
    device: "desktop",
    referrer: REF_DEV,
    ua: ua(2),
    ip: "203.0.113.38",
  },
  {
    country: "IE",
    continent: "EU",
    lat: 53.3498,
    lon: -6.2603,
    device: "desktop",
    referrer: REF_HN,
    ua: ua(6),
    ip: "203.0.113.39",
  },
  {
    country: "PL",
    continent: "EU",
    lat: 52.2297,
    lon: 21.0122,
    device: "mobile",
    referrer: null,
    ua: ua(4),
    ip: "203.0.113.40",
  },

  // Asia (~25%)
  {
    country: "IN",
    continent: "AS",
    lat: 12.9716,
    lon: 77.5946,
    device: "mobile",
    referrer: REF_LI,
    ua: ua(4),
    ip: "203.0.113.50",
  },
  {
    country: "IN",
    continent: "AS",
    lat: 19.076,
    lon: 72.8777,
    device: "mobile",
    referrer: REF_LI,
    ua: ua(4),
    ip: "203.0.113.51",
  },
  {
    country: "IN",
    continent: "AS",
    lat: 28.6139,
    lon: 77.209,
    device: "desktop",
    referrer: REF_GO,
    ua: ua(1),
    ip: "203.0.113.52",
  },
  {
    country: "JP",
    continent: "AS",
    lat: 35.6762,
    lon: 139.6503,
    device: "desktop",
    referrer: REF_HN,
    ua: ua(0),
    ip: "203.0.113.53",
  },
  {
    country: "JP",
    continent: "AS",
    lat: 34.6937,
    lon: 135.5023,
    device: "mobile",
    referrer: REF_X,
    ua: ua(3),
    ip: "203.0.113.54",
  },
  {
    country: "KR",
    continent: "AS",
    lat: 37.5665,
    lon: 126.978,
    device: "desktop",
    referrer: REF_GH,
    ua: ua(0),
    ip: "203.0.113.55",
  },
  {
    country: "SG",
    continent: "AS",
    lat: 1.3521,
    lon: 103.8198,
    device: "desktop",
    referrer: REF_HN,
    ua: ua(2),
    ip: "203.0.113.56",
  },
  {
    country: "HK",
    continent: "AS",
    lat: 22.3193,
    lon: 114.1694,
    device: "mobile",
    referrer: REF_LI,
    ua: ua(3),
    ip: "203.0.113.57",
  },
  {
    country: "TH",
    continent: "AS",
    lat: 13.7563,
    lon: 100.5018,
    device: "mobile",
    referrer: null,
    ua: ua(4),
    ip: "203.0.113.58",
  },
  {
    country: "ID",
    continent: "AS",
    lat: -6.2088,
    lon: 106.8456,
    device: "mobile",
    referrer: REF_RD,
    ua: ua(4),
    ip: "203.0.113.59",
  },
  {
    country: "PH",
    continent: "AS",
    lat: 14.5995,
    lon: 120.9842,
    device: "mobile",
    referrer: REF_TW,
    ua: ua(3),
    ip: "203.0.113.60",
  },
  {
    country: "VN",
    continent: "AS",
    lat: 21.0285,
    lon: 105.8542,
    device: "desktop",
    referrer: REF_GO,
    ua: ua(1),
    ip: "203.0.113.61",
  },
  {
    country: "TR",
    continent: "AS",
    lat: 41.0082,
    lon: 28.9784,
    device: "desktop",
    referrer: REF_LB,
    ua: ua(2),
    ip: "203.0.113.62",
  },

  // South America (~10%)
  {
    country: "BR",
    continent: "SA",
    lat: -23.5505,
    lon: -46.6333,
    device: "mobile",
    referrer: null,
    ua: ua(4),
    ip: "203.0.113.70",
  },
  {
    country: "BR",
    continent: "SA",
    lat: -22.9068,
    lon: -43.1729,
    device: "mobile",
    referrer: REF_X,
    ua: ua(3),
    ip: "203.0.113.71",
  },
  {
    country: "AR",
    continent: "SA",
    lat: -34.6037,
    lon: -58.3816,
    device: "desktop",
    referrer: REF_BSK,
    ua: ua(2),
    ip: "203.0.113.72",
  },
  {
    country: "CL",
    continent: "SA",
    lat: -33.4489,
    lon: -70.6693,
    device: "desktop",
    referrer: REF_GO,
    ua: ua(1),
    ip: "203.0.113.73",
  },
  {
    country: "CO",
    continent: "SA",
    lat: 4.711,
    lon: -74.0721,
    device: "mobile",
    referrer: REF_LI,
    ua: ua(4),
    ip: "203.0.113.74",
  },
  {
    country: "PE",
    continent: "SA",
    lat: -12.0464,
    lon: -77.0428,
    device: "mobile",
    referrer: null,
    ua: ua(4),
    ip: "203.0.113.75",
  },

  // Africa (~10%)
  {
    country: "NG",
    continent: "AF",
    lat: 6.5244,
    lon: 3.3792,
    device: "mobile",
    referrer: REF_LI,
    ua: ua(4),
    ip: "203.0.113.80",
  },
  {
    country: "ZA",
    continent: "AF",
    lat: -26.2041,
    lon: 28.0473,
    device: "desktop",
    referrer: REF_HN,
    ua: ua(0),
    ip: "203.0.113.81",
  },
  {
    country: "KE",
    continent: "AF",
    lat: -1.2921,
    lon: 36.8219,
    device: "mobile",
    referrer: REF_MAS,
    ua: ua(4),
    ip: "203.0.113.82",
  },
  {
    country: "EG",
    continent: "AF",
    lat: 30.0444,
    lon: 31.2357,
    device: "desktop",
    referrer: REF_GO,
    ua: ua(1),
    ip: "203.0.113.83",
  },
  {
    country: "MA",
    continent: "AF",
    lat: 33.5731,
    lon: -7.5898,
    device: "desktop",
    referrer: null,
    ua: ua(2),
    ip: "203.0.113.84",
  },
  {
    country: "GH",
    continent: "AF",
    lat: 5.6037,
    lon: -0.187,
    device: "mobile",
    referrer: REF_TW,
    ua: ua(3),
    ip: "203.0.113.85",
  },

  // Oceania (~5%)
  {
    country: "AU",
    continent: "OC",
    lat: -33.8688,
    lon: 151.2093,
    device: "desktop",
    referrer: REF_RD,
    ua: ua(1),
    ip: "203.0.113.90",
  },
  {
    country: "AU",
    continent: "OC",
    lat: -37.8136,
    lon: 144.9631,
    device: "mobile",
    referrer: REF_HN,
    ua: ua(4),
    ip: "203.0.113.91",
  },
  {
    country: "NZ",
    continent: "OC",
    lat: -36.8485,
    lon: 174.7633,
    device: "desktop",
    referrer: REF_DEV,
    ua: ua(2),
    ip: "203.0.113.92",
  },

];

// Continent share of total clicks. Sums to ~1.0.
export const CONTINENT_WEIGHTS: Record<City["continent"], number> = {
  NA: 0.28,
  EU: 0.22,
  AS: 0.26,
  SA: 0.1,
  AF: 0.1,
  OC: 0.04,
};

// Time-of-day weight (UTC hour 0-23). Peaks at ~9am Eastern (13Z), ~9am UTC,
// and ~9am Singapore (1Z). The simulator + seeder bias their click timestamps
// toward these hours.
export const HOURLY_WEIGHTS = (() => {
  const peaks = [1, 9, 13]; // Singapore, UTC, US East
  const sigma = 3;
  const w = new Array(24).fill(0.2);
  for (let h = 0; h < 24; h++) {
    for (const p of peaks) {
      const d = Math.min(Math.abs(h - p), 24 - Math.abs(h - p));
      w[h] += Math.exp(-(d * d) / (2 * sigma * sigma));
    }
  }
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
})();

export function pickCityByContinent(rng: () => number): City {
  const r = rng();
  let acc = 0;
  let chosen: City["continent"] = "NA";
  for (const cont of Object.keys(CONTINENT_WEIGHTS) as City["continent"][]) {
    acc += CONTINENT_WEIGHTS[cont];
    if (r <= acc) {
      chosen = cont;
      break;
    }
  }
  const candidates = CITIES.filter((c) => c.continent === chosen);
  const pick = candidates[Math.floor(rng() * candidates.length)] ?? CITIES[0];
  if (!pick) throw new Error("CITIES is empty");
  return pick;
}

export function pickHour(rng: () => number): number {
  const r = rng();
  let acc = 0;
  for (let h = 0; h < 24; h++) {
    acc += HOURLY_WEIGHTS[h] ?? 0;
    if (r <= acc) return h;
  }
  return 12;
}
