import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../../src/client/App.js";

describe("<App />", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("", { status: 401 }));
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("renders the home headline and a Watch the demo CTA", () => {
    render(<App />);
    expect(screen.getByText(/Live analytics\./i)).toBeInTheDocument();
    const demoCta = screen.getAllByRole("link", { name: /Watch the demo/i });
    expect(demoCta.some((a) => a.getAttribute("href") === "/demo")).toBe(true);
  });
});
