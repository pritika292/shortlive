import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { SeriesPoint } from "../hooks/useSeries.js";

function formatTs(ts: number): string {
  const d = new Date(ts);
  return `${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

export function TimeSeriesChart({ series }: { series: SeriesPoint[] }): JSX.Element {
  if (series.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-slate-500">
        No clicks in the last hour. Fire one with curl to watch it land.
      </div>
    );
  }
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="series-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
          <XAxis
            dataKey="ts"
            tickFormatter={formatTs}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={48}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={32}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: "rgba(16,185,129,0.4)", strokeWidth: 1 }}
            contentStyle={{
              background: "rgba(15,23,42,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: "10px 12px",
              fontSize: 12,
              color: "#e2e8f0",
            }}
            labelFormatter={(v: number) => new Date(v).toLocaleTimeString()}
            formatter={(value: number) => [value, "clicks"]}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#10b981"
            strokeWidth={2.5}
            fill="url(#series-area)"
            isAnimationActive={false}
            activeDot={{ r: 5, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
