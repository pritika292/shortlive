import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuickstartButton } from "../../src/client/components/QuickstartButton.js";

describe("<QuickstartButton />", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
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
  });

  it("opens the modal and POSTs to /api/quickstart on accept", async () => {
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

  it("shows a rate-limit error on 429 without navigating", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 }),
    );
    render(<QuickstartButton />);
    fireEvent.click(screen.getByRole("button", { name: /Quickstart/i }));
    await screen.findByText(/30-minute playground/i);
    fireEvent.click(screen.getByRole("button", { name: /Start playground/i }));
    await screen.findByText(/too many playgrounds/i);
  });
});
