import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useShortliveClicks } from "../hooks/useShortliveClicks.js";
import { useSeries, useBreakdown, type BreakdownRow } from "../hooks/useSeries.js";
import { LiveCounter } from "./LiveCounter.js";
import { RecentFeed } from "./RecentFeed.js";
import { WorldMap } from "./WorldMap.js";
import { TimeSeriesChart } from "./TimeSeriesChart.js";
import { Breakdown } from "./Breakdown.js";
import { TopBar } from "./TopBar.js";
import { Footer } from "./Footer.js";
import { ContinentFilter } from "./ContinentFilter.js";
import { CountryChipFilter } from "./CountryChipFilter.js";
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
      <main className="relative min-h-[calc(100vh-72px)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] bg-gradient-to-b from-emerald-200/30 via-cyan-100/10 to-transparent dark:from-emerald-500/10 dark:via-cyan-500/5"
        />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
          <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                {title}
              </h1>
              <p className="text-base text-slate-600 dark:text-slate-400 mt-2">{subtitle}</p>
            </div>
            <div className="flex items-center gap-4 flex-wrap justify-end">
              <ConnectionDot status={status} />
              {headerRight}
            </div>
          </header>

          <section className="mb-6 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-[0.18em] font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">
                  Continents
                </span>
                <ContinentFilter />
              </div>
              {hasFilter && (
                <button
                  type="button"
                  onClick={() => filters.clearAll()}
                  className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors"
                >
                  clear filter ×
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs uppercase tracking-[0.18em] font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">
                Countries
              </span>
              <CountryChipFilter />
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-3 mb-6">
            <Card title={hasFilter ? "Clicks (filtered)" : "Total clicks"} accent="emerald">
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
            <Card title="Clicks per minute (last hour)" accent="cyan">
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

          <section className="mb-6">
            <Card title="Click locations" accent="violet">
              <WorldMap
                points={mapPoints}
                filteredCountries={effectiveCountries.size > 0 ? effectiveCountries : undefined}
                filteredContinents={filters.continents.size > 0 ? filters.continents : undefined}
              />
            </Card>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

function ClickableBreakdown({ rows, label }: { rows: BreakdownRow[]; label: string }): JSX.Element {
  const filters = useDashboardFilters();
  if (rows.length === 0) {
    return <div className="text-sm text-slate-500">No {label.toLowerCase()} data yet.</div>;
  }
  return (
    <ul className="text-sm divide-y divide-slate-200/60 dark:divide-white/5">
      {rows.map((r) => {
        const active = filters.countries.has(r.value);
        return (
          <li key={r.value}>
            <button
              type="button"
              onClick={() => filters.toggleCountry(r.value)}
              className={
                "w-full flex items-center justify-between py-2 px-2 rounded-lg transition-colors " +
                (active
                  ? "bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 text-slate-900 dark:text-slate-100 ring-1 ring-emerald-400/30"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04]")
              }
            >
              <span className="text-left truncate max-w-[180px] font-medium" title={r.value}>
                {r.value}
              </span>
              <span className="flex items-center gap-3">
                <span className="tabular-nums font-semibold">{r.count}</span>
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
  accent,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  accent?: "emerald" | "cyan" | "violet";
}): JSX.Element {
  const accentBar =
    accent === "emerald"
      ? "bg-gradient-to-r from-emerald-400 to-cyan-400"
      : accent === "cyan"
        ? "bg-gradient-to-r from-cyan-400 to-sky-400"
        : accent === "violet"
          ? "bg-gradient-to-r from-violet-400 to-fuchsia-400"
          : "bg-slate-200 dark:bg-white/10";
  return (
    <div className={`glass-card p-6 ${className ?? ""}`}>
      <div className="flex items-center gap-3 mb-4">
        <span className={`h-2.5 w-2.5 rounded-full ${accentBar}`} aria-hidden />
        <div className="text-xs uppercase tracking-[0.18em] font-semibold text-slate-500 dark:text-slate-400">
          {title}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function ConnectionDot({ status }: { status: "connecting" | "open" | "closed" }): JSX.Element {
  const color =
    status === "open"
      ? "bg-emerald-400 shadow-emerald-400/60"
      : status === "connecting"
        ? "bg-amber-400 shadow-amber-400/60"
        : "bg-rose-500 shadow-rose-500/60";
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-white/60 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">
      <span className={`inline-block size-2 rounded-full ${color} shadow-md`} aria-hidden />
      {status}
    </span>
  );
}
