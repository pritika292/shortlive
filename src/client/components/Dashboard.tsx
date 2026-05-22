import { useEffect, useState, type ReactNode } from "react";
import { useShortliveClicks } from "../hooks/useShortliveClicks.js";
import { useSeries, useBreakdown } from "../hooks/useSeries.js";
import { LiveCounter } from "./LiveCounter.js";
import { RecentFeed } from "./RecentFeed.js";
import { ClickMap } from "./ClickMap.js";
import { TimeSeriesChart } from "./TimeSeriesChart.js";
import { Breakdown } from "./Breakdown.js";
import { TopBar } from "./TopBar.js";

const REFRESH_INTERVAL_MS = 10_000;

interface Props {
  short: string;
  title: string;
  subtitle: string;
  headerRight?: ReactNode;
  topBarCurrent?: "demo" | "analytics";
}

export function Dashboard({
  short,
  title,
  subtitle,
  headerRight,
  topBarCurrent,
}: Props): JSX.Element {
  const { totalClicks, recent, mapPoints, status, hydrated } = useShortliveClicks(short);

  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRefreshKey((k) => k + 1), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    setRefreshKey((k) => k + 1);
  }, [totalClicks]);

  const series = useSeries(short, refreshKey);
  const country = useBreakdown(short, "country", refreshKey);
  const referrer = useBreakdown(short, "referrer", refreshKey);
  const device = useBreakdown(short, "device", refreshKey);

  return (
    <>
      <TopBar current={topBarCurrent} />
      <main className="min-h-[calc(100vh-56px)] px-6 py-8 max-w-6xl mx-auto">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-slate-400">{subtitle}</p>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap justify-end">
            <ConnectionDot status={status} />
            {headerRight}
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-3 mb-6">
          <Card title="Total clicks">
            <LiveCounter count={totalClicks} />
          </Card>
          <Card title="Recent clicks" className="md:col-span-2">
            {hydrated || recent.length > 0 ? (
              <RecentFeed clicks={recent.slice(0, 8)} />
            ) : (
              <span className="text-sm text-slate-500">Connecting…</span>
            )}
          </Card>
        </section>

        <section className="grid gap-6 mb-6">
          <Card title="Clicks per minute (last hour)">
            <TimeSeriesChart series={series} />
          </Card>
        </section>

        <section className="grid gap-6 md:grid-cols-3 mb-6">
          <Card title="Top countries">
            <Breakdown rows={country} label="Country" />
          </Card>
          <Card title="Top referrers">
            <Breakdown rows={referrer} label="Referrer" />
          </Card>
          <Card title="Devices">
            <Breakdown rows={device} label="Device" />
          </Card>
        </section>

        <section>
          <Card title="Click locations">
            <ClickMap points={mapPoints} hydrated={hydrated} />
          </Card>
        </section>
      </main>
    </>
  );
}

function Card({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/50 p-5 ${className ?? ""}`}>
      <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">{title}</div>
      <div>{children}</div>
    </div>
  );
}

function ConnectionDot({ status }: { status: "connecting" | "open" | "closed" }): JSX.Element {
  const color =
    status === "open" ? "bg-emerald-400" : status === "connecting" ? "bg-amber-400" : "bg-rose-500";
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block size-2 rounded-full ${color}`} aria-hidden />
      <span>{status}</span>
    </span>
  );
}
