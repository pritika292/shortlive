import type { ClickEvent } from "../hooks/useShortliveClicks.js";
import { flagFor } from "../lib/flag.js";

function relativeTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / (60 * 60_000))}h ago`;
}

// Fixed slot count keeps the card height stable as clicks stream in —
// without this the list grows row-by-row and shoves everything below it
// down the page (#141). Empty slots render as faint dashed placeholders.
const MAX_ROWS = 10;

export function RecentFeed({ clicks }: { clicks: ClickEvent[] }): JSX.Element {
  // Drop null-country entries. They come from real visitors hitting /demo on
  // a host without GeoLite2 and would render as "Unknown" which reads like a
  // data-quality bug to anyone looking at the page.
  const visible = clicks.filter((c) => c.country !== null).slice(0, MAX_ROWS);
  const emptySlots = MAX_ROWS - visible.length;

  return (
    <ul className="space-y-1.5">
      {visible.length === 0 && (
        <li className="h-9 flex items-center justify-center text-sm text-slate-500">
          Waiting for the first click…
        </li>
      )}
      {visible.map((c, i) => (
        <li
          key={`${c.ts}-${i}`}
          className="h-9 flex items-center justify-between gap-3 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
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
      {visible.length > 0 &&
        Array.from({ length: emptySlots }).map((_, i) => (
          <li key={`slot-${i}`} aria-hidden className="h-9 px-3 rounded-lg flex items-center">
            <span className="block h-px w-full bg-slate-200/50 dark:bg-white/[0.05]" />
          </li>
        ))}
    </ul>
  );
}
