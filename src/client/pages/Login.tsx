import { useState } from "react";
import { TopBar } from "../components/TopBar.js";

export function LoginPage(): JSX.Element {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          body.error === "invalid_credentials" ? "Wrong username or password." : "Login failed.",
        );
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next") ?? "/create";
      window.location.assign(next);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <TopBar current="login" />
      <main className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6">
        <form
          onSubmit={submit}
          className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/50 p-6"
        >
          <h1 className="text-xl font-semibold tracking-tight mb-1">Sign in</h1>
          <p className="text-sm text-slate-400 mb-6">Use the credentials from your invite email.</p>

          <div className="grid gap-3 text-sm">
            <div className="grid gap-1">
              <label
                htmlFor="login-username"
                className="text-xs uppercase tracking-wider text-slate-500"
              >
                Username
              </label>
              <input
                id="login-username"
                type="text"
                required
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5"
              />
            </div>
            <div className="grid gap-1">
              <label
                htmlFor="login-password"
                className="text-xs uppercase tracking-wider text-slate-500"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5"
              />
            </div>
            {error && <div className="text-rose-400 text-xs">{error}</div>}
            <button
              type="submit"
              disabled={submitting || !username || !password}
              className="mt-2 bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-medium rounded px-4 py-1.5"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Credentials are issued out-of-band — there's no self-serve sign-up.
          </div>
        </form>
      </main>
    </>
  );
}
