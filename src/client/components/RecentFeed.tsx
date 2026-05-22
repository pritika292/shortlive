import type { ClickEvent } from "../hooks/useShortliveClicks.js";

function flagFor(country: string | null): string {
  if (!country || country.length !== 2) return "🌐";
  // Render a regional indicator flag via the 2-letter country code.
  const base = 0x1f1e6;
  const a = country.toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
  const b = country.toUpperCase().charCodeAt(1) - "A".charCodeAt(0);
  if (a < 0 || a > 25 || b < 0 || b > 25) return "🌐";
  return String.fromCodePoint(base + a) + String.fromCodePoint(base + b);
}

function relativeTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / (60 * 60_000))}h ago`;
}

export function RecentFeed({ clicks }: { clicks: ClickEvent[] }): JSX.Element {
  if (clicks.length === 0) {
    return <div className="text-sm text-slate-500">Waiting for clicks…</div>;
  }
  return (
    <ul className="text-sm divide-y divide-slate-800">
      {clicks.map((c, i) => (
        <li
          key={`${c.ts}-${i}`}
          className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
        >
          <span className="flex items-center gap-3">
            <span aria-hidden className="text-base">
              {flagFor(c.country)}
            </span>
            <span className="text-slate-300">{c.country ?? "??"}</span>
            {c.device ? <span className="text-xs text-slate-500">{c.device}</span> : null}
          </span>
          <span className="text-xs text-slate-500 tabular-nums">{relativeTime(c.ts)}</span>
        </li>
      ))}
    </ul>
  );
}
