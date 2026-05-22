import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuickstartButton } from "../../src/client/components/QuickstartButton.js";

describe("<QuickstartButton />", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Clear the warn-once flag so each test starts as a fresh-browser visitor
    // (modal shows). Individual tests opt into the warned state explicitly.
    window.localStorage.removeItem("shortlive:quickstart-warned");
    fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          username: "temp-abcd1234",
          expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
          temp: true,
        }),
        { status: 200 },
      ),
    );
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    window.localStorage.removeItem("shortlive:quickstart-warned");
  });

  it("opens the modal and POSTs to /api/quickstart on accept (first visit)", async () => {
    render(<QuickstartButton />);
    // Modal not shown yet.
    expect(screen.queryByText(/30-minute playground/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Quickstart/i }));
    await screen.findByText(/30-minute playground/i);

    fireEvent.click(screen.getByRole("button", { name: /Start playground/i }));
    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(
        (c) =>
          typeof c[0] === "string" &&
          c[0] === "/api/quickstart" &&
          (c[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(call).toBeDefined();
    });
  });

  it("skips the modal on subsequent visits and fires the POST directly", async () => {
    // Simulate a previously-warned browser.
    window.localStorage.setItem("shortlive:quickstart-warned", "1");
    render(<QuickstartButton />);
    fireEvent.click(screen.getByRole("button", { name: /Quickstart/i }));
    // No modal pops up.
    expect(screen.queryByText(/30-minute playground/i)).not.toBeInTheDocument();
    // POST fires straight away.
    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(
        (c) =>
          typeof c[0] === "string" &&
          c[0] === "/api/quickstart" &&
          (c[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(call).toBeDefined();
    });
  });

  it("shows a friendly error on 429 (playground full) without navigating", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "playground_at_capacity" }), { status: 429 }),
    );
    render(<QuickstartButton />);
    fireEvent.click(screen.getByRole("button", { name: /Quickstart/i }));
    await screen.findByText(/30-minute playground/i);
    fireEvent.click(screen.getByRole("button", { name: /Start playground/i }));
    await screen.findByText(/playground is full/i);
  });
});
