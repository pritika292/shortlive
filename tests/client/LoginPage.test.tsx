import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LoginPage } from "../../src/client/pages/Login.js";

describe("<LoginPage />", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function fillAndSubmit(username = "alice", password = "pw"): void {
    fireEvent.change(screen.getByLabelText(/^Username$/i), { target: { value: username } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: password } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
  }

  it("posts username + password to /login", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<LoginPage />);
    fillAndSubmit("alice", "correct");
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchSpy).toHaveBeenCalledWith("/login", expect.objectContaining({ method: "POST" }));
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ username: "alice", password: "correct" });
  });

  it("shows an error message on 401", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "invalid_credentials" }), { status: 401 }),
    );
    render(<LoginPage />);
    fillAndSubmit("alice", "wrong");
    await screen.findByText(/wrong username or password/i);
  });

  it("disables submit when fields are empty", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled();
  });
});
