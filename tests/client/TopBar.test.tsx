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

  it("guest view: Create your own points at /login?next=/create", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("", { status: 401 }));
    render(<TopBar />);
    await waitFor(() => {
      expect(screen.getByText(/Sign in/i)).toBeInTheDocument();
    });
    const createLink = screen.getByRole("link", { name: /Create your own/i });
    expect(createLink).toHaveAttribute("href", "/login?next=/create");
  });

  it("authed view: shows username and a sign-out button", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ username: "alice" }), { status: 200 }),
    );
    render(<TopBar />);
    await waitFor(() => {
      expect(screen.getByText("alice")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /Create your own/i })).toHaveAttribute(
      "href",
      "/create",
    );
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
