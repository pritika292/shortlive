import { TopBar } from "../components/TopBar.js";
import { Footer } from "../components/Footer.js";
import { LogoMark } from "../components/Logo.js";
import { useSession } from "../hooks/useSession.js";

export function HomePage(): JSX.Element {
  const session = useSession();
  const createHref = session.status === "authed" ? "/create" : "/login?next=/create";

  return (
    <>
      <TopBar current="home" />
      <main className="relative">
        {/* Hero band */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-200/40 via-cyan-100/20 to-fuchsia-200/30 dark:from-emerald-500/15 dark:via-cyan-500/10 dark:to-fuchsia-500/10"
          />
          <div
            aria-hidden
            className="absolute -top-32 -left-24 -z-10 h-[500px] w-[500px] rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/10"
          />
          <div
            aria-hidden
            className="absolute top-10 -right-24 -z-10 h-[500px] w-[500px] rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/10"
          />

          <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-20 pb-20">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-100/80 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 mb-6">
                  <span aria-hidden className="relative inline-flex h-2 w-2">
                    <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                    <span className="relative inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Live demo running now
                </div>
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-slate-900 dark:text-white mb-6">
                  Short URLs.
                  <br />
                  <span className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-500 bg-clip-text text-transparent">
                    Live analytics.
                  </span>
                  <br />
                  Smart webhooks.
                </h1>
                <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-xl leading-relaxed">
                  Watch every click land in under a second. Pin them on a map. Trigger HMAC-signed
                  webhooks when a click pattern matches your rule.
                </p>
                <div className="flex flex-wrap gap-3 text-base">
                  <a href="/demo" className="btn-primary text-base px-7 py-3">
                    <span aria-hidden className="relative inline-flex h-2 w-2 mr-1">
                      <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-75" />
                      <span className="relative inline-block h-2 w-2 rounded-full bg-white" />
                    </span>
                    Watch the live demo
                  </a>
                  <a href={createHref} className="btn-secondary text-base px-7 py-3">
                    Create your own
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                      aria-hidden
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </a>
                </div>

                <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
                  <Stat value="< 1s" label="click latency" />
                  <Stat value="4" label="rule types" />
                  <Stat value="HMAC" label="signed POSTs" />
                </div>
              </div>

              {/* Right column — mock dashboard preview */}
              <div className="relative">
                <div
                  className="absolute inset-0 -m-4 rounded-3xl bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 blur-2xl"
                  aria-hidden
                />
                <div className="relative glass-card p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30">
                        <LogoMark size={18} className="text-white" />
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">/demo</span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  </div>
                  <div className="text-5xl font-bold tabular-nums text-slate-900 dark:text-white mb-1">
                    1,842
                  </div>
                  <div className="text-xs uppercase tracking-wider text-slate-500 mb-6">
                    Total clicks
                  </div>
                  <SparkChart />
                  <div className="mt-5 space-y-2.5">
                    <FakeClick flag="🇺🇸" country="United States" device="desktop" />
                    <FakeClick flag="🇩🇪" country="Germany" device="mobile" />
                    <FakeClick flag="🇯🇵" country="Japan" device="desktop" />
                    <FakeClick flag="🇧🇷" country="Brazil" device="mobile" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities strip */}
        <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-12">
          <div className="grid gap-6 md:grid-cols-3">
            <Feature
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                  aria-hidden
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              }
              accent="emerald"
              title="Sub-second analytics"
            >
              Live click feed, world map, and time-series chart, pushed over a WebSocket so
              dashboards tick instantly.
            </Feature>
            <Feature
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              }
              accent="cyan"
              title="Four rule types"
            >
              Threshold, velocity (sliding window), first-of-kind, and per-click filters, each with
              cooldowns and per-rule destinations.
            </Feature>
            <Feature
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                  aria-hidden
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              }
              accent="violet"
              title="Signed webhooks"
            >
              HMAC-SHA256 delivery, 5-attempt exponential backoff, dead-letter queue on failure,
              idempotent retries.
            </Feature>
          </div>
        </section>

        {/* Stack ribbon */}
        <section className="border-y border-slate-200 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.02] py-8 overflow-hidden">
          <div className="text-center text-xs uppercase tracking-[0.2em] font-semibold text-slate-500 mb-6">
            Built with
          </div>
          <div className="marquee">
            {Array.from({ length: 2 }).map((_, dup) => (
              <div
                key={dup}
                className="flex items-center gap-10 px-5 text-slate-600 dark:text-slate-300 font-semibold text-lg"
              >
                <span>TypeScript</span>
                <span className="opacity-40">·</span>
                <span>React</span>
                <span className="opacity-40">·</span>
                <span>Vite</span>
                <span className="opacity-40">·</span>
                <span>Express</span>
                <span className="opacity-40">·</span>
                <span>Postgres</span>
                <span className="opacity-40">·</span>
                <span>Redis</span>
                <span className="opacity-40">·</span>
                <span>BullMQ</span>
                <span className="opacity-40">·</span>
                <span>WebSocket</span>
                <span className="opacity-40">·</span>
                <span>Leaflet</span>
                <span className="opacity-40">·</span>
                <span>Tailwind</span>
                <span className="opacity-40">·</span>
                <span>Docker</span>
                <span className="opacity-40">·</span>
                <span>Azure</span>
                <span className="opacity-40">·</span>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-emerald-600 dark:text-emerald-400 mb-2">
              How it works
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              From click to webhook in milliseconds
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-4">
            <Step n="1" title="Click">
              Visitor hits{" "}
              <code className="font-mono text-emerald-600 dark:text-emerald-400">/abc123</code> and
              we 302 to their target before logging anything.
            </Step>
            <Step n="2" title="Log">
              We enqueue the click async (GeoIP, device, referrer) and broadcast over Redis pub/sub.
            </Step>
            <Step n="3" title="Evaluate">
              Each owner-defined rule runs against the click. Sliding windows live in Redis ZSETs.
            </Step>
            <Step n="4" title="Deliver">
              Matching rules push jobs onto BullMQ. We POST HMAC-signed payloads with retries and a
              DLQ.
            </Step>
          </div>
        </section>

        {/* Final CTA */}
        <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-20">
          <div className="glass-card p-10 sm:p-14 text-center bg-gradient-to-br from-emerald-500/[0.04] via-cyan-500/[0.04] to-fuchsia-500/[0.04]">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
              See it tick in real time.
            </h2>
            <p className="text-slate-600 dark:text-slate-300 max-w-xl mx-auto mb-8 text-lg">
              The demo dashboard simulates traffic from 50+ cities. Watch the map light up, the
              chart fill in, the recent feed scroll.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <a href="/demo" className="btn-primary text-base px-7 py-3">
                Open the live demo
              </a>
              <a href={createHref} className="btn-secondary text-base px-7 py-3">
                Create your own link
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }): JSX.Element {
  return (
    <div>
      <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {value}
      </div>
      <div className="text-xs uppercase tracking-wider text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function FakeClick({
  flag,
  country,
  device,
}: {
  flag: string;
  country: string;
  device: string;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/60 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5">
      <span className="flex items-center gap-2.5 text-sm">
        <span className="text-base" aria-hidden>
          {flag}
        </span>
        <span className="font-medium text-slate-700 dark:text-slate-200">{country}</span>
        <span className="text-xs text-slate-500">{device}</span>
      </span>
      <span className="text-xs text-slate-500 tabular-nums">just now</span>
    </div>
  );
}

function SparkChart(): JSX.Element {
  // Decorative SVG sparkline — illustrative only.
  return (
    <svg viewBox="0 0 240 60" className="w-full h-16" aria-hidden>
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,50 L20,42 L40,46 L60,35 L80,38 L100,28 L120,32 L140,20 L160,25 L180,15 L200,22 L220,12 L240,18"
        stroke="#10b981"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M0,50 L20,42 L40,46 L60,35 L80,38 L100,28 L120,32 L140,20 L160,25 L180,15 L200,22 L220,12 L240,18 L240,60 L0,60 Z"
        fill="url(#spark)"
      />
    </svg>
  );
}

function Feature({
  icon,
  accent,
  title,
  children,
}: {
  icon: React.ReactNode;
  accent: "emerald" | "cyan" | "violet";
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  const iconBg =
    accent === "emerald"
      ? "from-emerald-500 to-cyan-500"
      : accent === "cyan"
        ? "from-cyan-500 to-sky-500"
        : "from-violet-500 to-fuchsia-500";
  return (
    <div className="glass-card p-7 group hover:translate-y-[-2px] transition-transform">
      <div
        className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${iconBg} text-white shadow-lg mb-5`}
      >
        {icon}
      </div>
      <div className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{title}</div>
      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{children}</p>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="glass-card p-6 relative">
      <div className="absolute -top-3 -left-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 text-white font-bold shadow-lg shadow-emerald-500/30">
        {n}
      </div>
      <div className="text-lg font-semibold text-slate-900 dark:text-white mb-2 mt-2">{title}</div>
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{children}</p>
    </div>
  );
}
