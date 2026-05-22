import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { WorldMap } from "../../src/client/components/WorldMap.js";

describe("<WorldMap />", () => {
  it("renders the world outline path and a pin per geo-tagged point", () => {
    const { container } = render(
      <WorldMap
        points={[
          { ts: 1, country: "US", lat: 37, lon: -122, device: "desktop", referrer: null },
          { ts: 2, country: "GB", lat: 51, lon: 0, device: "desktop", referrer: null },
          { ts: 3, country: null, lat: null, lon: null, device: null, referrer: null },
        ]}
      />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    // One <path d="..."> for the world outline.
    expect(container.querySelectorAll("svg > path").length).toBeGreaterThan(0);
    // Two pin groups (the no-coord click is skipped).
    expect(container.querySelectorAll("svg > g").length).toBe(2);
  });

  it("hides pins outside the active country filter", () => {
    const { container } = render(
      <WorldMap
        points={[
          { ts: 1, country: "US", lat: 37, lon: -122, device: "desktop", referrer: null },
          { ts: 2, country: "GB", lat: 51, lon: 0, device: "desktop", referrer: null },
        ]}
        filteredCountries={new Set(["US"])}
      />,
    );
    expect(container.querySelectorAll("svg > g").length).toBe(1);
  });
});
