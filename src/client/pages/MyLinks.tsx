import { useCallback, useEffect, useState } from "react";
import { useSession } from "../hooks/useSession.js";
import { TopBar } from "../components/TopBar.js";
import { Footer } from "../components/Footer.js";

interface Link {
  short: string;
  target: string;
  clickCount: number;
  createdAt: string;
  expiresAt: string | null;
}

export function MyLinksPage(): JSX.Element {
  const session = useSession();
  const [links, setLinks] = useState<Link[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/me/links", { credentials: "same-origin" });
      if (!res.ok) {
        setError(res.status === 401 ? "Sign in to see your links." : `HTTP ${res.status}`);
        setLinks([]);
        return;
      }
      const body = (await res.json()) as { links: Link[] };
      setLinks(body.links);
      setError(null);
    } catch {
      setError("Network error. Try again.");
    }
  }, []);

  useEffect(() => {
    if (session.status === "guest") {
      window.location.assign("/login?next=/links");
      return;
    }
    if (session.status === "authed") void refresh();
  }, [session.status, refresh]);

  async function deleteLink(short: string): Promise<void> {
    if (!confirm(`Delete /${short}? This removes the link and all its clicks and rules.`)) return;
    setDeleting(short);
    try {
      const res = await fetch(`/api/me/links/${encodeURIComponent(short)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        alert(`Delete failed (HTTP ${res.status})`);
        return;
      }
      await refresh();
    } finally {
      setDeleting(null);
    }
  }

  if (session.status === "loading" || links === null) {
    return (
      <main className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Loading…
      </main>
    );
  }
  if (session.status === "guest") {
    return <main className="min-h-screen" />;
  }

  return (
    <>
      <TopBar current="links" />
      <main className="relative min-h-[calc(100vh-72px)] max-w-6xl mx-auto px-6 lg:px-8 py-10">
        <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              Your links
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">
              Signed in as{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {session.user?.username}
              </span>
              .
            </p>
          </div>
          <a href="/create" className="btn-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New link
          </a>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 px-4 py-2.5 text-sm">
            {error}
          </div>
        )}

        {links.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <div className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
              No links yet
            </div>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Spin up your first short link and start collecting clicks.
            </p>
            <a href="/create" className="btn-primary">
              Create your first link
            </a>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/5">
                <tr>
                  <th className="text-left px-5 py-3.5">Short</th>
                  <th className="text-left px-5 py-3.5">Target</th>
                  <th className="text-right px-5 py-3.5">Clicks</th>
                  <th className="text-left px-5 py-3.5">Created</th>
                  <th className="text-right px-5 py-3.5 w-56">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-white/5 text-slate-700 dark:text-slate-300">
                {links.map((l) => (
                  <tr
                    key={l.short}
                    className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3.5 font-mono">
                      <a
                        className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300"
                        href={`/${l.short}`}
                      >
                        /{l.short}
                      </a>
                    </td>
                    <td className="px-5 py-3.5 truncate max-w-[280px]" title={l.target}>
                      {l.target}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-slate-900 dark:text-white">
                      {l.clickCount}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {new Date(l.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs space-x-2">
                      <a
                        className="inline-block px-3 py-1.5 rounded-full text-xs font-medium border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-700 dark:text-slate-200"
                        href={`/a/${l.short}`}
                      >
                        Analytics
                      </a>
                      <a
                        className="inline-block px-3 py-1.5 rounded-full text-xs font-medium border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-700 dark:text-slate-200"
                        href={`/a/${l.short}/rules`}
                      >
                        Rules
                      </a>
                      <button
                        type="button"
                        disabled={deleting === l.short}
                        onClick={() => void deleteLink(l.short)}
                        className="inline-block px-3 py-1.5 rounded-full text-xs font-medium border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-50"
                      >
                        {deleting === l.short ? "…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
