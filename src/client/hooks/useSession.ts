import { useCallback, useEffect, useState } from "react";

export interface SessionUser {
  username: string;
  // Set when the session belongs to a Quickstart playground user. The
  // TopBar uses this to render a countdown chip instead of the username.
  temp?: boolean;
  expires_at?: string;
}

export type SessionStatus = "loading" | "guest" | "authed";

export interface SessionState {
  status: SessionStatus;
  user: SessionUser | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useSession(): SessionState {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/whoami", { credentials: "same-origin" });
      if (res.ok) {
        const body = (await res.json()) as SessionUser;
        setUser(body);
        setStatus("authed");
      } else {
        setUser(null);
        setStatus("guest");
      }
    } catch {
      setUser(null);
      setStatus("guest");
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch("/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // Best-effort. The hard-navigate below tears down state regardless.
    }
    // Hard-navigate to home instead of just refreshing the in-memory session.
    // Without this, /analytics + /links keep their dashboard hooks alive —
    // WebSocket reconnects, click streams keep painting — even though the
    // user has signed out. The reload guarantees every subscription is torn
    // down and the user lands on a guest-appropriate page.
    if (typeof window !== "undefined") {
      window.location.assign("/");
      return;
    }
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, user, refresh, logout };
}
