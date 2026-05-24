import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TopBar } from "../components/TopBar.js";
import { Footer } from "../components/Footer.js";
import { ContinentFilter } from "../components/ContinentFilter.js";
import { CountryChipFilter } from "../components/CountryChipFilter.js";
import { LiveCounter } from "../components/LiveCounter.js";
import { RecentFeed } from "../components/RecentFeed.js";
import { WorldMap } from "../components/WorldMap.js";
import { DemoRulesPanel } from "../components/DemoRulesPanel.js";
import { TimeSeriesChart } from "../components/TimeSeriesChart.js";
import { Breakdown } from "../components/Breakdown.js";
import { RunDemoButton } from "../components/RunDemoButton.js";
import { PlaygroundBadge } from "../components/PlaygroundBadge.js";
import { DashboardFiltersProvider, useDashboardFilters } from "../contexts/DashboardFilters.js";
import { CURATED_COUNTRIES } from "../lib/continents.js";
import { useDemoSimulator } from "../hooks/useDemoSimulator.js";
import { useDemoRules } from "../hooks/useDemoRules.js";
import type { ClickEvent } from "../hooks/useShortliveClicks.js";
import type { BreakdownRow, SeriesPoint } from "../hooks/useSeries.js";

const KNOWN_COUNTRY_CODES = CURATED_COUNTRIES.map((c) => c.code);

export function DemoPage(): JSX.Element {
  return (
    <DashboardFiltersProvider knownCountries={KNOWN_COUNTRY_CODES}>
      <DemoInner />
    </DashboardFiltersProvider>
  );
}

function DemoInner(): JSX.Element {
  const sim = useDemoSimulator();
  const filters = useDashboardFilters();

  // The whole point of moving demo into the browser: filtering is now
  // synchronous over an in-memory array. The counter, chart, breakdowns, and
  // map all recompute in the same render that the user toggles a chip.
  const visible = useMemo(
    () => sim.events.filter((e) => filters.matches(e.country)),
    [sim.events, filters],
  );

  // Counter always reflects the filter (#121). With the #120 fix clearing
  // events on Start, this gives us the right behaviour for both states:
  // running -> count of burst clicks matching the filter; idle -> count of
  // seed/historical clicks matching the filter.
  const counterValue = visible.length;

  // Tick once per second so the rolling windows update visibly during a burst.
  // While idle the array doesn't change so this is a cheap no-op render.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);
  const windows = useMemo(() => countWindows(visible, now), [visible, now]);

  // Rule engine watches the unfiltered event stream — rules fire on the full
  // burst regardless of which chip the user is inspecting.
  const { rules, firings } = useDemoRules(sim.events, now);

  const series = useMemo(() => buildSeries(visible), [visible]);
  const country = useMemo(() => topBreakdown(visible, (e) => e.country, 5), [visible]);
  const referrer = useMemo(() => topBreakdown(visible, (e) => e.referrer, 5), [visible]);
  const device = useMemo(() => topBreakdown(visible, (e) => e.device, 5), [visible]);

  return (
    <>
      <TopBar current="demo" />
      <main className="relative min-h-[calc(100vh-72px)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] bg-gradient-to-b from-emerald-200/30 via-cyan-100/10 to-transparent dark:from-emerald-500/10 dark:via-cyan-500/5"
        />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
          <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Live demo
              </h1>
              <p className="text-base text-slate-600 dark:text-slate-400 mt-2">
                Press start to generate synthetic clicks. Everything runs locally so chip toggles
                are instant.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <PlaygroundBadge />
              <RunDemoButton
                running={sim.running}
                remainingSeconds={sim.remainingSeconds}
                onStart={sim.startBurst}
              />
            </div>
          </header>

          <section className="mb-6 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs uppercase tracking-[0.18em] font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">
                Continents
              </span>
              <ContinentFilter />
              {filters.hasFilter && (
                <button
                  type="button"
                  onClick={() => filters.clearAll()}
                  className="ml-auto text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors"
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
            <Card
              title={
                sim.running
                  ? "Live demo clicks"
                  : filters.hasFilter
                    ? "Clicks (filtered)"
                    : "Total clicks"
              }
              accent="emerald"
            >
              <LiveCounter count={counterValue} />
              <WindowedCounts windows={windows} />
            </Card>
            <Card title="Recent clicks" className="md:col-span-2">
              <RecentFeed clicks={visible} />
            </Card>
          </section>

          <section className="grid gap-6 mb-6">
            <Card title="Clicks per second (last minute)" accent="cyan">
              <TimeSeriesChart series={series} />
            </Card>
          </section>

          <section className="grid gap-6 md:grid-cols-3 mb-6">
            <Card title="Top 5 countries">
              <Breakdown rows={country} label="Country" showFlag />
            </Card>
            <Card title="Top 5 referrers">
              <Breakdown rows={referrer} label="Referrer" />
            </Card>
            <Card title="Top devices">
              <Breakdown rows={device} label="Device" />
            </Card>
          </section>

          <section className="mb-6">
            <Card title="Click locations" accent="violet">
              <WorldMap points={visible.slice(0, 100)} />
            </Card>
          </section>

          <section className="mb-6">
            <Card title="Rule-based webhooks" accent="emerald">
              <DemoRulesPanel rules={rules} firings={firings} now={now} />
            </Card>
          </section>
        </div>
      </main>
      <Footer />
    </>
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

interface WindowCounts {
  s15: number;
  m1: number;
  m5: number;
  m30: number;
}

function countWindows(events: ClickEvent[], now: number): WindowCounts {
  const cutoffs = { s15: now - 15_000, m1: now - 60_000, m5: now - 300_000, m30: now - 1_800_000 };
  const out: WindowCounts = { s15: 0, m1: 0, m5: 0, m30: 0 };
  for (const e of events) {
    if (e.ts >= cutoffs.s15) out.s15++;
    if (e.ts >= cutoffs.m1) out.m1++;
    if (e.ts >= cutoffs.m5) out.m5++;
    if (e.ts >= cutoffs.m30) out.m30++;
  }
  return out;
}

function WindowedCounts({ windows }: { windows: WindowCounts }): JSX.Element {
  const items: Array<{ label: string; value: number }> = [
    { label: "15s", value: windows.s15 },
    { label: "1m", value: windows.m1 },
    { label: "5m", value: windows.m5 },
    { label: "30m", value: windows.m30 },
  ];
  return (
    <dl className="mt-4 pt-4 border-t border-slate-200/60 dark:border-white/5 divide-y divide-slate-200/40 dark:divide-white/[0.04]">
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline justify-between py-2">
          <dt className="text-[11px] uppercase tracking-[0.18em] font-semibold text-slate-500 dark:text-slate-400">
            {it.label}
          </dt>
          <dd className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Bucket clicks by second over the last minute. The simulator fires roughly
// one click every 0.1-1s during a burst, so per-second buckets give a chart
// with ~60 data points filling left-to-right.
function buildSeries(events: ClickEvent[]): SeriesPoint[] {
  const now = Date.now();
  const windowMs = 60_000;
  const cutoff = now - windowMs;
  const buckets = new Map<number, number>();
  // Pre-populate the 60 buckets so the chart shows the full window even when
  // most seconds had zero events. Without this, Recharts only draws bars
  // where data exists and the cold-load chart looks ragged.
  for (let t = cutoff; t <= now; t += 1_000) {
    buckets.set(Math.floor(t / 1_000) * 1_000, 0);
  }
  for (const e of events) {
    if (e.ts < cutoff) continue;
    const bucket = Math.floor(e.ts / 1_000) * 1_000;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  return [...buckets.entries()].sort(([a], [b]) => a - b).map(([ts, count]) => ({ ts, count }));
}

function topBreakdown<T extends string | null>(
  events: ClickEvent[],
  pick: (e: ClickEvent) => T,
  limit: number,
): BreakdownRow[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const e of events) {
    const v = pick(e);
    if (v === null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
    total++;
  }
  const rows = [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([value, count]) => ({
      value,
      count,
      percent: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
    }));
  return rows;
}
