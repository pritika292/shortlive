import { useEffect, useState } from "react";
import { useSession } from "../hooks/useSession.js";
import { ThemeToggle } from "./ThemeToggle.js";
import { LogoMark } from "./Logo.js";
import { QuickstartButton } from "./QuickstartButton.js";

interface Props {
  current?: "home" | "demo" | "create" | "links" | "login" | "analytics" | "rules" | "about";
}

export function TopBar({ current }: Props = {}): JSX.Element {
  const session = useSession();
  const isAuthed = session.status === "authed";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 dark:border-white/5 bg-white/75 dark:bg-slate-950/75 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-950/60">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex items-center gap-6">
        <a href="/" className="flex items-center gap-2.5 group" aria-label="shortlive home">
          <span className="relative inline-flex">
            <span
              aria-hidden
              className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-400/30 to-cyan-400/30 blur-md group-hover:from-emerald-400/50 group-hover:to-cyan-400/50 transition-all"
            />
            <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30">
              <LogoMark size={22} className="text-white" />
            </span>
          </span>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            shortlive
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-1 text-sm ml-2">
          <NavLink href="/demo" active={current === "demo"} highlight>
            <span aria-hidden className="relative inline-flex h-2 w-2 mr-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative inline-block h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live demo
          </NavLink>
          {isAuthed && (
            <>
              <NavLink href="/create" active={current === "create"}>
                Create
              </NavLink>
              <NavLink href="/links" active={current === "links"}>
                My links
              </NavLink>
            </>
          )}
          <NavLink href="/about" active={current === "about"}>
            About
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <ThemeToggle />
          {session.status === "loading" ? (
            <span className="text-slate-500 text-xs">…</span>
          ) : isAuthed ? (
            <div className="flex items-center gap-2">
              {session.user?.temp && session.user.expires_at ? (
                <PlaygroundCountdown expiresAt={session.user.expires_at} />
              ) : (
                <span className="hidden sm:inline-flex items-center gap-2 px-3 h-10 rounded-full border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span className="inline-flex h-6 w-6 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 text-white text-xs font-bold items-center justify-center">
                    {session.user?.username?.[0]?.toUpperCase() ?? "?"}
                  </span>
                  {session.user?.username}
                </span>
              )}
              <button
                type="button"
                onClick={() => void session.logout()}
                className="icon-btn"
                title="Sign out"
                aria-label="Sign out"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          ) : (
            <QuickstartButton variant="compact">Quickstart</QuickstartButton>
          )}
        </div>
      </div>
    </header>
  );
}

function PlaygroundCountdown({ expiresAt }: { expiresAt: string }): JSX.Element {
  const expiresMs = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => Math.max(0, expiresMs - Date.now()));
  useEffect(() => {
    const id = setInterval(() => {
      const next = Math.max(0, expiresMs - Date.now());
      setRemaining(next);
      // When the playground session ends, refresh the page so the server's
      // session middleware can clear our cookie and we land back on guest UI.
      if (next === 0) window.location.reload();
    }, 1_000);
    return () => clearInterval(id);
  }, [expiresMs]);
  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1_000);
  return (
    <span
      title="Temporary playground session. Data wipes when the timer runs out."
      className="inline-flex items-center gap-2 px-3 h-10 rounded-full border border-amber-300/70 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-sm font-medium text-amber-800 dark:text-amber-200"
    >
      <span aria-hidden className="relative inline-flex h-2 w-2">
        <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75" />
        <span className="relative inline-block h-2 w-2 rounded-full bg-amber-500" />
      </span>
      <span className="tabular-nums">
        Playground · {mins}m {secs.toString().padStart(2, "0")}s
      </span>
    </span>
  );
}

function NavLink({
  href,
  active,
  highlight,
  children,
}: {
  href: string;
  active?: boolean;
  highlight?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  const base = "inline-flex items-center px-4 py-2 rounded-full font-medium transition-all";
  let cls: string;
  if (active) {
    cls = "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md";
  } else if (highlight) {
    cls = "text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10";
  } else {
    cls =
      "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]";
  }
  return (
    <a href={href} className={`${base} ${cls}`}>
      {children}
    </a>
  );
}
