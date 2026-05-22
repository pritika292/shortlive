import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ClickMap } from "../../src/client/components/ClickMap.js";

// Leaflet pokes at the DOM in ways jsdom doesn't fully implement (window size,
// L.Point math). Stub the methods we touch so the component can mount under
// jsdom and we can assert on its surface.
const map = {
  remove: vi.fn(),
  removeLayer: vi.fn(),
};
const tileLayer = { addTo: vi.fn().mockReturnValue({}) };

const addToCalls: Array<{ lat: number; lon: number }> = [];

vi.mock("leaflet", () => ({
  default: {
    map: vi.fn(() => map),
    tileLayer: vi.fn(() => tileLayer),
    circleMarker: vi.fn((latlng: [number, number]) => {
      addToCalls.push({ lat: latlng[0], lon: latlng[1] });
      return {
        addTo: vi.fn().mockReturnThis(),
        setStyle: vi.fn(),
      };
    }),
  },
}));

describe("<ClickMap />", () => {
  it("renders the map container and adds pins for hydration points with coords", () => {
    addToCalls.length = 0;
    const points = [
      { ts: 1, country: "US", lat: 37, lon: -122, device: null, referrer: null },
      { ts: 2, country: "GB", lat: 51, lon: 0, device: null, referrer: null },
      // No-coord entry: should NOT cause a pin
      { ts: 3, country: null, lat: null, lon: null, device: null, referrer: null },
    ];
    const { container } = render(<ClickMap points={points} hydrated={true} />);
    expect(container.querySelector("div")).toBeInTheDocument();
    expect(addToCalls).toHaveLength(2);
    expect(addToCalls[0]).toEqual({ lat: 37, lon: -122 });
  });

  it("does not add hydration pins before hydrated=true", () => {
    addToCalls.length = 0;
    render(
      <ClickMap
        points={[{ ts: 1, country: "US", lat: 37, lon: -122, device: null, referrer: null }]}
        hydrated={false}
      />,
    );
    expect(addToCalls).toHaveLength(0);
  });
});
