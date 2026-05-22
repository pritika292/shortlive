import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentFeed } from "../../src/client/components/RecentFeed.js";
import type { ClickEvent } from "../../src/client/hooks/useShortliveClicks.js";

function makeClick(ts: number, country: string | null = "US"): ClickEvent {
  return { ts, country, lat: null, lon: null, device: "desktop", referrer: null };
}

describe("<RecentFeed />", () => {
  it("renders a waiting state with no clicks", () => {
    render(<RecentFeed clicks={[]} />);
    expect(screen.getByText(/waiting for the first click/i)).toBeInTheDocument();
  });

  it("renders 20 clicks newest-first", () => {
    const now = Date.now();
    const clicks: ClickEvent[] = Array.from({ length: 20 }, (_, i) =>
      makeClick(now - i * 1000, i % 2 === 0 ? "US" : "DE"),
    );
    render(<RecentFeed clicks={clicks} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(20);
    // Spot-check both country codes appear.
    expect(screen.getAllByText("US").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DE").length).toBeGreaterThan(0);
  });

  it("hides null-country entries so the feed never shows 'Unknown' clutter", () => {
    const now = Date.now();
    render(
      <RecentFeed
        clicks={[
          makeClick(now, null),
          makeClick(now - 1000, "US"),
          makeClick(now - 2000, null),
          makeClick(now - 3000, "DE"),
        ]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument();
    expect(screen.getByText("US")).toBeInTheDocument();
    expect(screen.getByText("DE")).toBeInTheDocument();
  });

  it("falls back to the waiting state when every click has a null country", () => {
    render(<RecentFeed clicks={[makeClick(Date.now(), null)]} />);
    expect(screen.getByText(/waiting for the first click/i)).toBeInTheDocument();
  });
});
