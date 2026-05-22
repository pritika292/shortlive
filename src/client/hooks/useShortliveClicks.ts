import { useEffect, useReducer, useRef } from "react";

export interface ClickEvent {
  ts: number;
  country: string | null;
  lat: number | null;
  lon: number | null;
  device: string | null;
  referrer: string | null;
}

interface State {
  status: "connecting" | "open" | "closed";
  totalClicks: number;
  recent: ClickEvent[];
  hydrated: boolean;
}

type Action =
  | { type: "set_status"; status: State["status"] }
  | { type: "set_total"; total: number }
  | { type: "hydrate"; clicks: ClickEvent[] }
  | { type: "click"; click: ClickEvent };

const MAX_RECENT = 20;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set_status":
      return { ...state, status: action.status };
    case "set_total":
      return { ...state, totalClicks: action.total };
    case "hydrate":
      return {
        ...state,
        recent: action.clicks.slice(0, MAX_RECENT),
        hydrated: true,
      };
    case "click":
      return {
        ...state,
        totalClicks: state.totalClicks + 1,
        recent: [action.click, ...state.recent].slice(0, MAX_RECENT),
      };
  }
}

const initialState: State = {
  status: "connecting",
  totalClicks: 0,
  recent: [],
  hydrated: false,
};

function wsUrl(short: string): string {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/${encodeURIComponent(short)}`;
}

export function useShortliveClicks(short: string): State {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectMsRef = useRef(500);

  useEffect(() => {
    let cancelled = false;

    const fetchSummary = async (): Promise<void> => {
      try {
        const r = await fetch(`/api/short/${encodeURIComponent(short)}/summary`);
        if (!r.ok) return;
        const j = (await r.json()) as { totalClicks: number };
        if (!cancelled) dispatch({ type: "set_total", total: j.totalClicks });
      } catch {
        // Best-effort; the WS hydration still gives us recent activity.
      }
    };

    const connect = (): void => {
      if (cancelled) return;
      dispatch({ type: "set_status", status: "connecting" });
      const ws = new WebSocket(wsUrl(short));
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        if (cancelled) return;
        dispatch({ type: "set_status", status: "open" });
        reconnectMsRef.current = 500;
      });

      ws.addEventListener("message", (e) => {
        try {
          const msg = JSON.parse(typeof e.data === "string" ? e.data : "");
          if (msg.type === "hydration") {
            dispatch({ type: "hydrate", clicks: msg.clicks as ClickEvent[] });
          } else if (msg.type === "click") {
            dispatch({ type: "click", click: msg.click as ClickEvent });
          }
        } catch {
          // ignore malformed
        }
      });

      ws.addEventListener("close", () => {
        if (cancelled) return;
        dispatch({ type: "set_status", status: "closed" });
        const delay = Math.min(reconnectMsRef.current, 10_000);
        reconnectMsRef.current = Math.min(reconnectMsRef.current * 2, 10_000);
        setTimeout(connect, delay);
      });

      ws.addEventListener("error", () => {
        ws.close();
      });
    };

    void fetchSummary();
    connect();

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [short]);

  return state;
}
