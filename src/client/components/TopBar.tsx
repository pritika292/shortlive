import { useSession } from "../hooks/useSession.js";
import { ThemeToggle } from "./ThemeToggle.js";
import { LogoMark } from "./Logo.js";

interface Props {
  current?: "home" | "demo" | "create" | "links" | "login" | "analytics" | "rules" | "about";
}

export function TopBar({ current }: Props = {}): JSX.Element {
  const session = useSession();
  const isAuthed = session.status === "authed";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-950/60">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-6">
        <a
          href="/"
          className="flex items-center gap-2 text-slate-900 dark:text-slate-100 hover:text-black dark:hover:text-white"
        >
          <LogoMark size={22} className="text-sky-600 dark:text-sky-400" />
          <span className="text-lg font-semibold tracking-tight">shortlive</span>
        </a>

        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/demo" active={current === "demo"}>
            Demo
          </NavLink>
          <NavLink
            href={isAuthed ? "/create" : "/login?next=/create"}
            active={current === "create"}
          >
            Create your own
          </NavLink>
          {isAuthed && (
            <NavLink href="/links" active={current === "links"}>
              My links
            </NavLink>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3 text-sm">
          <ThemeToggle />
          {session.status === "loading" ? (
            <span className="text-slate-500 text-xs">…</span>
          ) : isAuthed ? (
            <>
              <span className="text-slate-500 dark:text-slate-400 text-xs">
                {session.user?.username ?? "signed in"}
              </span>
              <button
                type="button"
                onClick={() => void session.logout()}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              >
                sign out
              </button>
            </>
          ) : (
            <a
              href="/login"
              className="text-xs text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white"
              data-current={current === "login"}
            >
              Sign in
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <a
      href={href}
      className={`px-3 py-1.5 rounded-full transition-colors ${
        active
          ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
      }`}
    >
      {children}
    </a>
  );
}
