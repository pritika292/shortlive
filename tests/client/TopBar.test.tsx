import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { TopBar } from "../../src/client/components/TopBar.js";

describe("<TopBar />", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("guest view: nav hides Create + My links and shows a Quickstart button instead of Sign in", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("", { status: 401 }));
    render(<TopBar />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Quickstart/i })).toBeInTheDocument();
    });
    // Guest nav is Live demo + About only.
    expect(screen.queryByRole("link", { name: /^Create$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^My links$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Sign in$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Live demo/i })).toHaveAttribute("href", "/demo");
    expect(screen.getByRole("link", { name: /About/i })).toHaveAttribute("href", "/about");
  });

  it("authed view: shows username and a sign-out button", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ username: "alice" }), { status: 200 }),
    );
    render(<TopBar />);
    await waitFor(() => {
      expect(screen.getByText("alice")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /^Create$/i })).toHaveAttribute("href", "/create");
    expect(screen.getByRole("link", { name: /My links/i })).toHaveAttribute("href", "/links");
  });

  it("signing out POSTs /logout", async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({ username: "alice" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 401 }));

    render(<TopBar />);
    await waitFor(() => expect(screen.getByText("alice")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/logout", expect.objectContaining({ method: "POST" }));
    });
  });
});
