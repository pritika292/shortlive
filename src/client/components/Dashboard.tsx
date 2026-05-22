import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useShortliveClicks } from "../hooks/useShortliveClicks.js";
import { useSeries, useBreakdown, type BreakdownRow } from "../hooks/useSeries.js";
import { LiveCounter } from "./LiveCounter.js";
import { RecentFeed } from "./RecentFeed.js";
import { ClickMap } from "./ClickMap.js";
import { TimeSeriesChart } from "./TimeSeriesChart.js";
import { Breakdown } from "./Breakdown.js";
import { TopBar } from "./TopBar.js";
import { Footer } from "./Footer.js";
import { ContinentFilter } from "./ContinentFilter.js";
import { DashboardFiltersProvider, useDashboardFilters } from "../contexts/DashboardFilters.js";
import { continentOf } from "../lib/continents.js";

const REFRESH_INTERVAL_MS = 10_000;

interface Props {
  short: string;
  title: string;
  subtitle: string;
  headerRight?: ReactNode;
  topBarCurrent?: "demo" | "analytics";
}

export function Dashboard(props: Props): JSX.Element {
  return (
    <DashboardFiltersProvider>
      <DashboardInner {...props} />
    </DashboardFiltersProvider>
  );
}

function DashboardInner({
  short,
  title,
  subtitle,
  headerRight,
  topBarCurrent,
}: Props): JSX.Element {
  const { totalClicks, recent, mapPoints, status, hydrated } = useShortliveClicks(short);
  const filters = useDashboardFilters();

  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRefreshKey((k) => k + 1), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    setRefreshKey((k) => k + 1);
  }, [totalClicks]);

  // Unfiltered top-20 used to expand continent filters into country sets.
  const allCountries = useBreakdown(short, "country", refreshKey, undefined, 20);

  const effectiveCountries = useMemo(() => {
    const set = new Set(filters.countries);
    if (filters.continents.size > 0) {
      for (const row of allCountries) {
        const cc = continentOf(row.value);
        if (cc && filters.continents.has(cc)) set.add(row.value);
      }
    }
    return set;
  }, [filters.countries, filters.continents, allCountries]);

  const seriesFilters = effectiveCountries.size
    ? { countries: [...effectiveCountries] }
    : undefined;

  const series = useSeries(short, refreshKey, seriesFilters);
  const country = useBreakdown(short, "country", refreshKey, seriesFilters, 20);
  const referrer = useBreakdown(short, "referrer", refreshKey, seriesFilters, 5);
  const device = useBreakdown(short, "device", refreshKey, seriesFilters, 5);

  const hasFilter = effectiveCountries.size > 0 || filters.continents.size > 0;

  return (
    <>
      <TopBar current={topBarCurrent} />
      <main className="min-h-[calc(100vh-56px)] px-6 py-8 max-w-6xl mx-auto">
        <header className="mb-6 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap justify-end">
            <ConnectionDot status={status} />
            {headerRight}
          </div>
        </header>

        <section className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <ContinentFilter />
          {hasFilter && (
            <button
              type="button"
              onClick={() => filters.clearAll()}
              className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            >
              clear filter
            </button>
          )}
        </section>

        <section className="grid gap-6 md:grid-cols-3 mb-6">
          <Card title={hasFilter ? "Clicks (filtered)" : "Total clicks"}>
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
            <ClickableBreakdown rows={country} label="Country" />
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
            <ClickMap
              points={mapPoints}
              hydrated={hydrated}
              filteredCountries={effectiveCountries.size > 0 ? effectiveCountries : undefined}
            />
          </Card>
        </section>
      </main>
      <Footer />
    </>
  );
}

function ClickableBreakdown({ rows, label }: { rows: BreakdownRow[]; label: string }): JSX.Element {
  const filters = useDashboardFilters();
  if (rows.length === 0) {
    return <div className="text-xs text-slate-500">No {label.toLowerCase()} data yet.</div>;
  }
  return (
    <ul className="text-sm divide-y divide-slate-200 dark:divide-slate-800">
      {rows.map((r) => {
        const active = filters.countries.has(r.value);
        return (
          <li key={r.value}>
            <button
              type="button"
              onClick={() => filters.toggleCountry(r.value)}
              className={
                "w-full flex items-center justify-between py-1.5 px-1 rounded transition-colors " +
                (active
                  ? "bg-sky-100 dark:bg-sky-900/40 text-slate-900 dark:text-slate-100"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60")
              }
            >
              <span className="text-left truncate max-w-[180px]" title={r.value}>
                {r.value}
              </span>
              <span className="flex items-center gap-3">
                <span className="tabular-nums">{r.count}</span>
                <span className="tabular-nums text-slate-500 w-10 text-right">{r.percent}%</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
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
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-5 ${className ?? ""}`}
    >
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
