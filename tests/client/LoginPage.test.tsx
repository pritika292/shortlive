import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LoginPage } from "../../src/client/pages/Login.js";

describe("<LoginPage />", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Default behavior: TopBar's /whoami returns guest. Tests override the
    // form-submit responses with mockResolvedValueOnce or a wider mockImpl.
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url === "/whoami") {
        return new Response("", { status: 401 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function fillAndSubmit(username = "alice", password = "pw"): void {
    fireEvent.change(screen.getByLabelText(/^Username$/i), { target: { value: username } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: password } });
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/i }));
  }

  it("posts username + password to /login", async () => {
    render(<LoginPage />);
    fillAndSubmit("alice", "correct");
    await new Promise((r) => setTimeout(r, 10));
    const loginCall = fetchSpy.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0] === "/login",
    );
    expect(loginCall).toBeDefined();
    const body = JSON.parse((loginCall![1] as RequestInit).body as string);
    expect(body).toEqual({ username: "alice", password: "correct" });
  });

  it("shows an error message on 401", async () => {
    fetchSpy.mockImplementation(async (url) => {
      if (typeof url === "string" && url === "/whoami") return new Response("", { status: 401 });
      return new Response(JSON.stringify({ error: "invalid_credentials" }), { status: 401 });
    });
    render(<LoginPage />);
    fillAndSubmit("alice", "wrong");
    await screen.findByText(/wrong username or password/i);
  });

  it("disables submit when fields are empty", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /^Sign in$/i })).toBeDisabled();
  });
});
