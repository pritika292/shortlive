import { existsSync } from "node:fs";
import maxmind, { type CityResponse, type Reader } from "maxmind";
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
        `GeoLite2 mmdb not found (GEOLITE2_PATH=${p ?? "<unset>"}); geo lookups will return nulls.`,
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
  if (!reader) return EMPTY;
  try {
    const r = reader.get(ip);
    if (!r) return EMPTY;
    return {
      country: r.country?.iso_code ?? null,
      lat: r.location?.latitude ?? null,
      lon: r.location?.longitude ?? null,
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
