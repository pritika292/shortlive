import { describe, expect, it, beforeEach } from "vitest";
import { initGeo, lookup, resetGeoForTests } from "../../src/server/services/geo.js";

describe("geo lookup", () => {
  beforeEach(() => {
    resetGeoForTests();
  });

  it("falls back to the bundled geoip-lite data when no mmdb is configured", async () => {
    await initGeo("/nonexistent/path/to.mmdb");
    // 8.8.8.8 (Google DNS) is in every geoip dataset; we just assert that
    // we resolve a country code, not the specific value, so the test isn't
    // brittle if the bundled snapshot changes.
    const r = lookup("8.8.8.8");
    expect(r.country).not.toBeNull();
    expect(typeof r.country).toBe("string");
    expect(r.lat).not.toBeNull();
    expect(r.lon).not.toBeNull();
  });

  it("returns nulls for an IP geoip-lite can't resolve (private range)", async () => {
    await initGeo("/nonexistent/path/to.mmdb");
    expect(lookup("10.0.0.1")).toEqual({ country: null, lat: null, lon: null });
  });

  it("works before init too (defer-init guard via geoip-lite)", () => {
    // No initGeo call; lookup should still fall back to geoip-lite.
    const r = lookup("8.8.8.8");
    expect(r.country).not.toBeNull();
  });
});
