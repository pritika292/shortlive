import { existsSync } from "node:fs";
import maxmind, { type CityResponse, type Reader } from "maxmind";
import geoip from "geoip-lite";
import { config } from "../config.js";

export interface GeoLookup {
  country: string | null;
  lat: number | null;
  lon: number | null;
}

const EMPTY: GeoLookup = { country: null, lat: null, lon: null };

let reader: Reader<CityResponse> | null = null;
let initialized = false;
let warned = false;

export async function initGeo(pathOverride?: string): Promise<void> {
  initialized = true;
  const p = pathOverride ?? config().GEOLITE2_PATH;
  if (!p || !existsSync(p)) {
    if (!warned) {
      console.warn(
        `GeoLite2 mmdb not found (GEOLITE2_PATH=${p ?? "<unset>"}); falling back to bundled geoip-lite data.`,
      );
      warned = true;
    }
    return;
  }
  reader = await maxmind.open<CityResponse>(p);
}

export function lookup(ip: string): GeoLookup {
  if (!initialized) {
    // Defer-init for environments where the server didn't call initGeo().
    initialized = true;
  }
  // Prefer the official MaxMind data when the host has the mmdb installed
  // (more accurate). Fall back to the bundled geoip-lite dataset so real
  // visitor clicks always have something to plot, even on hosts that
  // haven't been seeded.
  if (reader) {
    try {
      const r = reader.get(ip);
      if (r) {
        return {
          country: r.country?.iso_code ?? null,
          lat: r.location?.latitude ?? null,
          lon: r.location?.longitude ?? null,
        };
      }
    } catch {
      // Fall through to geoip-lite below.
    }
  }
  try {
    const r = geoip.lookup(ip);
    if (!r) return EMPTY;
    return {
      country: r.country || null,
      lat: r.ll?.[0] ?? null,
      lon: r.ll?.[1] ?? null,
    };
  } catch {
    return EMPTY;
  }
}

export function resetGeoForTests(): void {
  reader = null;
  initialized = false;
  warned = false;
}
