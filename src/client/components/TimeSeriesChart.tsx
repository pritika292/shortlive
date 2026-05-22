import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { SeriesPoint } from "../hooks/useSeries.js";

function formatTs(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function TimeSeriesChart({ series }: { series: SeriesPoint[] }): JSX.Element {
  if (series.length === 0) {
    return <div className="text-sm text-slate-500">No clicks in the last hour.</div>;
  }
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <XAxis
            dataKey="ts"
            tickFormatter={formatTs}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "#1e293b" }}
            tickLine={{ stroke: "#1e293b" }}
            minTickGap={32}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "#1e293b" }}
            tickLine={{ stroke: "#1e293b" }}
            width={28}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
            labelFormatter={(v: number) => new Date(v).toLocaleTimeString()}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
