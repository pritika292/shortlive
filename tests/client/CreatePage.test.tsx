import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CreatePage } from "../../src/client/pages/Create.js";

describe("<CreatePage />", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function mockWhoami(status: number, body: unknown = {}): void {
    fetchSpy.mockImplementationOnce(async () => new Response(JSON.stringify(body), { status }));
  }

  it("renders the form for an authed user and submits the right body", async () => {
    mockWhoami(200, { username: "alice" });
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ short: "abc1234", url: "http://x/abc1234" }), { status: 200 }),
    );

    render(<CreatePage />);
    await screen.findByLabelText(/destination url/i);

    fireEvent.change(screen.getByLabelText(/destination url/i), {
      target: { value: "https://example.com" },
    });
    fireEvent.change(screen.getByLabelText(/custom code/i), {
      target: { value: "my-link" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create short link/i }));
    await screen.findByText(/short link created/i);

    const body = JSON.parse(fetchSpy.mock.calls[1]![1]?.body as string);
    expect(body).toEqual({ target: "https://example.com", custom_short: "my-link" });
    expect(screen.getByText("http://x/abc1234")).toBeInTheDocument();
  });

  it("surfaces a friendly message on 409 shortcode_taken", async () => {
    mockWhoami(200, { username: "alice" });
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "shortcode_taken" }), { status: 409 }),
    );
    render(<CreatePage />);
    await screen.findByLabelText(/destination url/i);

    fireEvent.change(screen.getByLabelText(/destination url/i), {
      target: { value: "https://example.com" },
    });
    fireEvent.change(screen.getByLabelText(/custom code/i), { target: { value: "taken" } });
    fireEvent.click(screen.getByRole("button", { name: /create short link/i }));

    await screen.findByText(/already in use/i);
  });
});
