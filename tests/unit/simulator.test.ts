import { describe, expect, it } from "vitest";
import { pickSyntheticCity } from "../../src/server/seed/simulator.js";

describe("simulator", () => {
  it("pickSyntheticCity returns a valid ISO-3166 alpha-2 country", () => {
    for (let i = 0; i < 50; i++) {
      const c = pickSyntheticCity();
      expect(c.country).toMatch(/^[A-Z]{2}$/);
      expect(c.ua.length).toBeGreaterThan(0);
      expect(typeof c.lat).toBe("number");
      expect(typeof c.lon).toBe("number");
    }
  });
});
