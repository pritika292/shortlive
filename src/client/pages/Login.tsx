import { useState } from "react";
import { TopBar } from "../components/TopBar.js";
import { Footer } from "../components/Footer.js";
import { LogoMark } from "../components/Logo.js";

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
      <main className="relative min-h-[calc(100vh-72px)] flex items-center justify-center px-6 py-12 overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-24 left-1/2 -translate-x-1/2 -z-10 h-[400px] w-[700px] rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/10"
        />
        <form onSubmit={submit} className="w-full max-w-md glass-card p-8 sm:p-10">
          <div className="flex justify-center mb-6">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30">
              <LogoMark size={28} className="text-white" />
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-center text-slate-900 dark:text-white mb-2">
            Welcome back
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-8">
            Use the credentials from your invite to sign in.
          </p>

          <div className="grid gap-4 text-sm">
            <div className="grid gap-1.5">
              <label
                htmlFor="login-username"
                className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400"
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
                className="bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
              />
            </div>
            <div className="grid gap-1.5">
              <label
                htmlFor="login-password"
                className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400"
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
                className="bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
              />
            </div>
            {error && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 px-4 py-2.5 text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting || !username || !password}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed mt-2 py-3 text-base"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </div>

          <div className="mt-8 text-xs text-center text-slate-500 dark:text-slate-500">
            Credentials are issued out of band. There is no self-serve sign-up.
          </div>
        </form>
      </main>
      <Footer />
    </>
  );
}
