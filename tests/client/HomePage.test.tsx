import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomePage } from "../../src/client/pages/Home.js";

describe("<HomePage />", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("", { status: 401 }));
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("renders the brand, headline, two CTAs, and three features", () => {
    render(<HomePage />);
    expect(screen.getAllByText(/shortlive/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Live analytics\./i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Watch the demo/i })).toHaveAttribute("href", "/demo");
    // Quickstart is the primary CTA now. It appears in the TopBar, the
    // hero, and the final CTA section for guests, so assert at least one.
    expect(screen.getAllByRole("button", { name: /Quickstart/i }).length).toBeGreaterThan(0);

    // First match wins. "Live analytics" also appears in the hero gradient
    // headline, so use getAllByText and assert non-empty rather than getByText.
    expect(screen.getAllByText(/Live analytics/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Four rule types/)).toBeInTheDocument();
    expect(screen.getByText(/Signed webhooks/)).toBeInTheDocument();
  });
});
