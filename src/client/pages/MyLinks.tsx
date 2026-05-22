import { useCallback, useEffect, useState } from "react";
import { useSession } from "../hooks/useSession.js";
import { TopBar } from "../components/TopBar.js";

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
      <main className="min-h-[calc(100vh-56px)] px-6 py-8 max-w-4xl mx-auto">
        <header className="mb-8 flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your links</h1>
            <p className="text-sm text-slate-400">
              Signed in as <span className="text-slate-300">{session.user?.username}</span>.
            </p>
          </div>
          <a className="text-sm text-sky-400 hover:text-sky-300" href="/create">
            + new link
          </a>
        </header>

        {error && <div className="text-sm text-rose-400 mb-4">{error}</div>}

        {links.length === 0 ? (
          <div className="text-sm text-slate-500">
            You haven't created any links yet —{" "}
            <a className="text-sky-400 hover:text-sky-300" href="/create">
              create one
            </a>
            .
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500 bg-slate-900">
                <tr>
                  <th className="text-left px-4 py-2 font-normal">Short</th>
                  <th className="text-left px-4 py-2 font-normal">Target</th>
                  <th className="text-right px-4 py-2 font-normal">Clicks</th>
                  <th className="text-left px-4 py-2 font-normal">Created</th>
                  <th className="text-right px-4 py-2 font-normal w-48">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {links.map((l) => (
                  <tr key={l.short}>
                    <td className="px-4 py-2 font-mono">
                      <a className="text-sky-400 hover:text-sky-300" href={`/${l.short}`}>
                        /{l.short}
                      </a>
                    </td>
                    <td className="px-4 py-2 truncate max-w-[280px]" title={l.target}>
                      {l.target}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{l.clickCount}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {new Date(l.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-right text-xs">
                      <a className="text-sky-400 hover:text-sky-300 mr-3" href={`/a/${l.short}`}>
                        analytics
                      </a>
                      <a
                        className="text-sky-400 hover:text-sky-300 mr-3"
                        href={`/a/${l.short}/rules`}
                      >
                        rules
                      </a>
                      <button
                        type="button"
                        disabled={deleting === l.short}
                        onClick={() => void deleteLink(l.short)}
                        className="text-rose-400 hover:text-rose-300 disabled:opacity-50"
                      >
                        {deleting === l.short ? "…" : "delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
