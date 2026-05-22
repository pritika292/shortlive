import type { BreakdownRow } from "../hooks/useSeries.js";

export function Breakdown({ rows, label }: { rows: BreakdownRow[]; label: string }): JSX.Element {
  if (rows.length === 0) {
    return <div className="text-sm text-slate-500">No {label.toLowerCase()} data yet.</div>;
  }
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const pct = (r.count / max) * 100;
        return (
          <li key={r.value} className="text-sm">
            <div className="flex items-center justify-between mb-1">
              <span
                className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]"
                title={r.value}
              >
                {r.value}
              </span>
              <span className="flex items-center gap-3 text-xs">
                <span className="tabular-nums font-semibold text-slate-900 dark:text-white">
                  {r.count}
                </span>
                <span className="tabular-nums text-slate-500 w-10 text-right">{r.percent}%</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200/60 dark:bg-white/[0.05] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
