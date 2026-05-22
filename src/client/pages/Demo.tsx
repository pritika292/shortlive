import { useShortliveClicks } from "../hooks/useShortliveClicks.js";
import { LiveCounter } from "../components/LiveCounter.js";
import { RecentFeed } from "../components/RecentFeed.js";
import { ClickMap } from "../components/ClickMap.js";

export function DemoPage(): JSX.Element {
  const { totalClicks, recent, mapPoints, status, hydrated } = useShortliveClicks("demo");

  return (
    <main className="min-h-screen px-6 py-8 max-w-6xl mx-auto">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">shortlive · demo</h1>
          <p className="text-sm text-slate-400">Live click analytics for the public demo link.</p>
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-3">
          <ConnectionDot status={status} />
          <a className="hover:text-slate-300" href="/">
            ← home
          </a>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-3 mb-6">
        <Card title="Total clicks">
          <LiveCounter count={totalClicks} />
        </Card>
        <Card title="Recent clicks">
          {hydrated || recent.length > 0 ? (
            <RecentFeed clicks={recent.slice(0, 8)} />
          ) : (
            <span className="text-sm text-slate-500">Connecting…</span>
          )}
        </Card>
        <Card title="Time series">
          <span className="text-sm text-slate-500">chart coming next</span>
        </Card>
      </section>

      <section className="grid gap-6">
        <Card title="Click locations">
          <ClickMap points={mapPoints} hydrated={hydrated} />
        </Card>
      </section>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
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
