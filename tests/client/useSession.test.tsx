import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useSession } from "../../src/client/hooks/useSession.js";

describe("useSession", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("resolves to authed after a successful /whoami", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ username: "alice" }), { status: 200 }),
    );
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe("authed"));
    expect(result.current.user?.username).toBe("alice");
  });

  it("resolves to guest on 401", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("", { status: 401 }));
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe("guest"));
    expect(result.current.user).toBeNull();
  });

  it("logout POSTs /logout and navigates to /", async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({ username: "alice" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 200 })); // logout
    const assignSpy = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      value: { ...original, assign: assignSpy },
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe("authed"));
    await result.current.logout();
    expect(fetchSpy).toHaveBeenCalledWith("/logout", expect.objectContaining({ method: "POST" }));
    expect(assignSpy).toHaveBeenCalledWith("/");
    Object.defineProperty(window, "location", {
      value: original,
      writable: true,
      configurable: true,
    });
  });
});
