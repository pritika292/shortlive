import { describe, expect, it, beforeEach } from "vitest";
import { initGeo, lookup, resetGeoForTests } from "../../src/server/services/geo.js";

describe("geo lookup", () => {
  beforeEach(() => {
    resetGeoForTests();
  });

  it("returns nulls when no mmdb is configured", async () => {
    await initGeo("/nonexistent/path/to.mmdb");
    expect(lookup("1.2.3.4")).toEqual({ country: null, lat: null, lon: null });
  });

  it("returns nulls before init too (defer-init guard)", () => {
    expect(lookup("1.2.3.4")).toEqual({ country: null, lat: null, lon: null });
  });
});
