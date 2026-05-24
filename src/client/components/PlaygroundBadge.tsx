import { useEffect, useState } from "react";
import { useSession } from "../hooks/useSession.js";

// "Playground · 23m 41s" countdown shown on page headers when the visitor
// is in a temp playground session. Lives outside the TopBar so the TopBar
// can stay compact next to the contact strip + theme toggle even as the
// playground-mode pill grows. Pages that want it render it themselves in
// their header-right slot. (#150 follow-up)
export function PlaygroundBadge(): JSX.Element | null {
  const session = useSession();
  if (session.status !== "authed") return null;
  if (!session.user?.temp || !session.user.expires_at) return null;
  return <Countdown expiresAt={session.user.expires_at} />;
}

function Countdown({ expiresAt }: { expiresAt: string }): JSX.Element {
  const expiresMs = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => Math.max(0, expiresMs - Date.now()));
  useEffect(() => {
    const id = setInterval(() => {
      const next = Math.max(0, expiresMs - Date.now());
      setRemaining(next);
      // When the playground session ends, hard-navigate home so every
      // dashboard hook and WebSocket subscription unmounts and the user
      // lands on a guest-appropriate page. Reloading the current page is
      // not enough — analytics/links would keep tracking against the now-
      // dead session.
      if (next === 0 && typeof window !== "undefined") {
        window.location.assign("/");
      }
    }, 1_000);
    return () => clearInterval(id);
  }, [expiresMs]);
  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1_000);
  return (
    <span
      title="Temporary playground session. Data wipes when the timer runs out."
      className="inline-flex items-center gap-2 px-3 h-10 rounded-full border border-amber-300/70 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-sm font-medium text-amber-800 dark:text-amber-200 whitespace-nowrap"
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
