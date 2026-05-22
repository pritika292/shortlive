import type { BreakdownRow } from "../hooks/useSeries.js";

export function Breakdown({ rows, label }: { rows: BreakdownRow[]; label: string }): JSX.Element {
  if (rows.length === 0) {
    return <div className="text-xs text-slate-500">No {label.toLowerCase()} data yet.</div>;
  }
  return (
    <table className="w-full text-sm">
      <thead className="text-xs uppercase tracking-wider text-slate-500">
        <tr>
          <th className="text-left pb-2 font-normal">{label}</th>
          <th className="text-right pb-2 font-normal">#</th>
          <th className="text-right pb-2 font-normal w-12">%</th>
        </tr>
      </thead>
      <tbody className="text-slate-300">
        {rows.map((r) => (
          <tr key={r.value} className="border-t border-slate-800">
            <td className="py-1.5 truncate max-w-[180px]" title={r.value}>
              {r.value}
            </td>
            <td className="py-1.5 text-right tabular-nums">{r.count}</td>
            <td className="py-1.5 text-right tabular-nums text-slate-500">{r.percent}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
