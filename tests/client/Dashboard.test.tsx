import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dashboard } from "../../src/client/components/Dashboard.js";

// Recharts + Leaflet both poke at things jsdom doesn't fully implement.
// Stub them at the module level — we only care that the dashboard wires
// up the four card categories.
vi.mock("../../src/client/components/ClickMap.js", () => ({
  ClickMap: () => <div data-testid="map-stub" />,
}));
vi.mock("../../src/client/components/TimeSeriesChart.js", () => ({
  TimeSeriesChart: () => <div data-testid="chart-stub" />,
}));

class FakeWebSocket {
  static OPEN = 1;
  readyState = 0;
  onopen: ((e: unknown) => void) | null = null;
  onmessage: ((e: unknown) => void) | null = null;
  onclose: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  constructor(public url: string) {}
  send(): void {}
  close(): void {}
  addEventListener(): void {}
}

describe("<Dashboard />", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let originalWebSocket: typeof globalThis.WebSocket;

  beforeEach(() => {
    fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ totalClicks: 0, rows: [], series: [] }), { status: 200 }),
      );
    originalWebSocket = globalThis.WebSocket;
    (globalThis as { WebSocket: unknown }).WebSocket = FakeWebSocket;
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    (globalThis as { WebSocket: unknown }).WebSocket = originalWebSocket;
  });

  it("renders the title, subtitle, and the four card categories", () => {
    render(<Dashboard short="demo" title="shortlive · demo" subtitle="Live analytics." />);
    expect(screen.getByText(/shortlive · demo/)).toBeInTheDocument();
    expect(screen.getByText(/Live analytics\./)).toBeInTheDocument();
    expect(screen.getByText(/Total clicks/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent clicks/i)).toBeInTheDocument();
    expect(screen.getByText(/Clicks per minute/i)).toBeInTheDocument();
    expect(screen.getByText(/Top countries/i)).toBeInTheDocument();
    expect(screen.getByText(/Top referrers/i)).toBeInTheDocument();
    expect(screen.getByText(/Devices/i)).toBeInTheDocument();
    expect(screen.getByText(/Click locations/i)).toBeInTheDocument();
  });
});
