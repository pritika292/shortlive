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

  // Both MyLinksPage's useSession and TopBar's useSession hit /whoami; respond
  // authed to any /whoami call. linksResponses[] is a queue of GET /api/me/links
  // responses; the next non-/whoami GET pops the head.
  function setup(linksResponses: Response[], onDelete?: Response): void {
    fetchSpy.mockImplementation(async (url, init) => {
      if (typeof url === "string" && url === "/whoami") {
        return new Response(JSON.stringify({ username: "alice" }), { status: 200 });
      }
      if (typeof url === "string" && url.startsWith("/api/me/links")) {
        const method = (init as RequestInit | undefined)?.method;
        if (method === "DELETE" && onDelete) {
          return onDelete.clone();
        }
        if (linksResponses.length > 0) {
          return linksResponses.shift()!.clone();
        }
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
  }

  function linksRes(links: unknown[]): Response {
    return new Response(JSON.stringify({ links }), { status: 200 });
  }

  it("renders the empty state when the user has no links", async () => {
    setup([linksRes([])]);
    render(<MyLinksPage />);
    await screen.findByText(/no links yet/i);
  });

  it("renders rows with the analytics, rules, and delete actions", async () => {
    setup([
      linksRes([
        {
          short: "abc1234",
          target: "https://example.com",
          clickCount: 42,
          createdAt: new Date().toISOString(),
          expiresAt: null,
        },
      ]),
    ]);
    render(<MyLinksPage />);
    await screen.findByText("/abc1234");
    expect(screen.getByRole("link", { name: /analytics/i })).toHaveAttribute("href", "/a/abc1234");
    expect(screen.getByRole("link", { name: /^rules$/i })).toHaveAttribute(
      "href",
      "/a/abc1234/rules",
    );
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("calls DELETE and refreshes on delete confirm", async () => {
    setup(
      [
        linksRes([
          {
            short: "del4567",
            target: "https://x",
            clickCount: 0,
            createdAt: new Date().toISOString(),
            expiresAt: null,
          },
        ]),
        linksRes([]),
      ],
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    render(<MyLinksPage />);
    await screen.findByText("/del4567");
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await screen.findByText(/no links yet/i);
    const deleteCall = fetchSpy.mock.calls.find(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("/api/me/links/del4567") &&
        (c[1] as RequestInit | undefined)?.method === "DELETE",
    );
    expect(deleteCall).toBeDefined();
  });
});
