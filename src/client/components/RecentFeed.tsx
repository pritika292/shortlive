import type { ClickEvent } from "../hooks/useShortliveClicks.js";

function flagFor(country: string | null): string {
  if (!country || country.length !== 2) return "🌐";
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
  // Drop null-country entries. They come from real visitors hitting /demo on
  // a host without GeoLite2 and would render as "Unknown" which reads like a
  // data-quality bug to anyone looking at the page.
  const visible = clicks.filter((c) => c.country !== null);
  if (visible.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-slate-500">Waiting for the first click…</div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {visible.map((c, i) => (
        <li
          key={`${c.ts}-${i}`}
          className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
        >
          <span className="flex items-center gap-3 min-w-0">
            <span aria-hidden className="text-xl shrink-0">
              {flagFor(c.country)}
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-100">{c.country}</span>
            {c.device ? (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">
                {c.device}
              </span>
            ) : null}
          </span>
          <span className="text-xs text-slate-500 tabular-nums shrink-0">{relativeTime(c.ts)}</span>
        </li>
      ))}
    </ul>
  );
}
