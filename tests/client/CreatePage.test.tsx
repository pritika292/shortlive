import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CreatePage } from "../../src/client/pages/Create.js";

describe("<CreatePage />", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  // Both CreatePage's useSession AND TopBar's useSession hit /whoami; respond
  // to all /whoami calls as authed by default so the form renders.
  function setupAuthed(): void {
    fetchSpy.mockImplementation(async (url) => {
      if (typeof url === "string" && url === "/whoami") {
        return new Response(JSON.stringify({ username: "alice" }), { status: 200 });
      }
      // Default safe response; tests override with mockImplementationOnce.
      return new Response(JSON.stringify({}), { status: 200 });
    });
  }

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("renders the form for an authed user and submits the right body", async () => {
    setupAuthed();
    fetchSpy.mockImplementationOnce(async (url) => {
      // First call is /whoami — authed.
      if (typeof url === "string" && url === "/whoami") {
        return new Response(JSON.stringify({ username: "alice" }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
    // Specific override for /shorten:
    const originalImpl = fetchSpy.getMockImplementation();
    fetchSpy.mockImplementation(async (url, init) => {
      if (typeof url === "string" && url === "/whoami") {
        return new Response(JSON.stringify({ username: "alice" }), { status: 200 });
      }
      if (typeof url === "string" && url === "/shorten") {
        return new Response(JSON.stringify({ short: "abc1234", url: "http://x/abc1234" }), {
          status: 200,
        });
      }
      return (originalImpl ?? (async () => new Response("", { status: 200 })))(url, init);
    });

    render(<CreatePage />);
    await screen.findByLabelText(/destination url/i);

    fireEvent.change(screen.getByLabelText(/destination url/i), {
      target: { value: "https://example.com" },
    });
    fireEvent.change(screen.getByLabelText(/custom code/i), {
      target: { value: "my-link" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create short link/i }));
    await screen.findByText(/your short link is live/i);

    const shortenCall = fetchSpy.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0] === "/shorten",
    );
    expect(shortenCall).toBeDefined();
    const body = JSON.parse((shortenCall![1] as RequestInit).body as string);
    expect(body).toEqual({ target: "https://example.com", custom_short: "my-link" });
    expect(screen.getByText("http://x/abc1234")).toBeInTheDocument();
  });

  it("surfaces a friendly message on 409 shortcode_taken", async () => {
    fetchSpy.mockImplementation(async (url) => {
      if (typeof url === "string" && url === "/whoami") {
        return new Response(JSON.stringify({ username: "alice" }), { status: 200 });
      }
      if (typeof url === "string" && url === "/shorten") {
        return new Response(JSON.stringify({ error: "shortcode_taken" }), { status: 409 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
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
