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

  it("renders the lockup, headline, two CTAs, and three features", () => {
    render(<HomePage />);
    expect(screen.getAllByText(/shortlive/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Short URLs with live click analytics and rule-based webhooks\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Watch the demo/i })).toHaveAttribute("href", "/demo");
    // Guest: Create CTA points at login?next=/create
    const create = screen.getAllByRole("link", { name: /Create your own/i });
    expect(create.some((a) => a.getAttribute("href") === "/login?next=/create")).toBe(true);

    expect(screen.getByText(/Sub-second analytics/)).toBeInTheDocument();
    expect(screen.getByText(/Four rule types/)).toBeInTheDocument();
    expect(screen.getByText(/Signed webhooks/)).toBeInTheDocument();
  });
});
