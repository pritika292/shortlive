import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MyLinksPage } from "../../src/client/pages/MyLinks.js";

describe("<MyLinksPage />", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
    confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  function mockWhoami(authed = true): void {
    fetchSpy.mockImplementationOnce(async () =>
      authed
        ? new Response(JSON.stringify({ username: "alice" }), { status: 200 })
        : new Response("", { status: 401 }),
    );
  }

  it("renders the empty state when the user has no links", async () => {
    mockWhoami();
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ links: [] }), { status: 200 }));
    render(<MyLinksPage />);
    await screen.findByText(/haven't created any links yet/i);
  });

  it("renders rows with the analytics, rules, and delete actions", async () => {
    mockWhoami();
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          links: [
            {
              short: "abc1234",
              target: "https://example.com",
              clickCount: 42,
              createdAt: new Date().toISOString(),
              expiresAt: null,
            },
          ],
        }),
        { status: 200 },
      ),
    );
    render(<MyLinksPage />);
    await screen.findByText("/abc1234");
    expect(screen.getByRole("link", { name: /^analytics$/ })).toHaveAttribute("href", "/a/abc1234");
    expect(screen.getByRole("link", { name: /^rules$/ })).toHaveAttribute(
      "href",
      "/a/abc1234/rules",
    );
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("calls DELETE and refreshes on delete confirm", async () => {
    mockWhoami();
    fetchSpy
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            links: [
              {
                short: "del4567",
                target: "https://x",
                clickCount: 0,
                createdAt: new Date().toISOString(),
                expiresAt: null,
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ links: [] }), { status: 200 }));

    render(<MyLinksPage />);
    await screen.findByText("/del4567");
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    await screen.findByText(/haven't created any links yet/i);
    const deleteCall = fetchSpy.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("/api/me/links/del4567"),
    );
    expect(deleteCall).toBeDefined();
    expect((deleteCall![1] as RequestInit).method).toBe("DELETE");
  });
});
