import { describe, expect, it } from "vitest";
import {
  CITIES,
  CONTINENT_WEIGHTS,
  HOURLY_WEIGHTS,
  pickHour,
} from "../../src/server/seed/cities.ts";

describe("seed/cities", () => {
  it("has >= 50 cities", () => {
    expect(CITIES.length).toBeGreaterThanOrEqual(50);
  });

  it("covers every inhabited continent", () => {
    const continents = new Set(CITIES.map((c) => c.continent));
    for (const c of ["AF", "AS", "EU", "NA", "OC", "SA"] as const) {
      expect(continents.has(c)).toBe(true);
    }
  });

  it("device mix has all three categories", () => {
    const set = new Set(CITIES.map((c) => c.device));
    expect(set.has("desktop")).toBe(true);
    expect(set.has("mobile")).toBe(true);
    expect(set.has("tablet")).toBe(true);
  });

  it("continent weights roughly sum to 1.0", () => {
    const sum = Object.values(CONTINENT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(0.98);
    expect(sum).toBeLessThan(1.02);
  });

  it("hourly weights sum to 1.0 and peak at business hours", () => {
    const sum = HOURLY_WEIGHTS.reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(0.99);
    expect(sum).toBeLessThan(1.01);
    // The 13Z weight should beat the 4Z weight.
    expect(HOURLY_WEIGHTS[13]).toBeGreaterThan(HOURLY_WEIGHTS[4]!);
  });

  it("pickHour returns hours 0..23", () => {
    const rng = (() => {
      let i = 0;
      return () => (i++ * 0.137) % 1;
    })();
    for (let n = 0; n < 100; n++) {
      const h = pickHour(rng);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(24);
    }
  });
});
