import { useCallback, useEffect, useState } from "react";

export interface SessionUser {
  username: string;
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
      // Best-effort. Refresh below will reflect the real server state.
    }
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, user, refresh, logout };
}
