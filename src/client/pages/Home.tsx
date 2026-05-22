import { TopBar } from "../components/TopBar.js";
import { Footer } from "../components/Footer.js";
import { LogoLockup } from "../components/Logo.js";
import { useSession } from "../hooks/useSession.js";

export function HomePage(): JSX.Element {
  const session = useSession();
  const createHref = session.status === "authed" ? "/create" : "/login?next=/create";

  return (
    <>
      <TopBar current="home" />
      <main className="min-h-[calc(100vh-56px)]">
        {/* Hero band */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-br from-sky-200/40 via-transparent to-fuchsia-200/30 dark:from-sky-500/15 dark:via-transparent dark:to-fuchsia-500/10"
          />
          <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
            <div className="mb-8 flex justify-center">
              <LogoLockup size={56} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 mb-4 max-w-3xl mx-auto">
              Short URLs with live click analytics and rule-based webhooks.
            </h1>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-8">
              Watch every click land in under a second. Configure rules that POST to your receiver
              when a click pattern matches.
            </p>
            <div className="flex flex-wrap gap-3 justify-center text-sm">
              <a
                href="/demo"
                className="px-4 py-2 rounded-full bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 font-medium"
              >
                Watch the demo
              </a>
              <a
                href={createHref}
                className="px-4 py-2 rounded-full border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
              >
                Create your own
              </a>
            </div>
          </div>
        </section>

        {/* Feature strip */}
        <section className="max-w-5xl mx-auto px-6 pb-20">
          <div className="grid gap-6 md:grid-cols-3 text-sm">
            <Feature emoji="⚡" title="Sub-second analytics">
              Live click feed, world map, time-series chart — all update in real time over a
              WebSocket.
            </Feature>
            <Feature emoji="🎯" title="Four rule types">
              Threshold, velocity (sliding window), first-of-kind, and per-click filters — with
              cooldowns.
            </Feature>
            <Feature emoji="🪝" title="Signed webhooks">
              HMAC-SHA256 deliveries, 5-attempt exponential backoff, DLQ on failure, idempotent
              retries.
            </Feature>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Feature({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-5">
      <div className="text-2xl mb-2" aria-hidden>
        {emoji}
      </div>
      <div className="font-medium text-slate-900 dark:text-slate-100 mb-1">{title}</div>
      <p className="text-slate-600 dark:text-slate-400">{children}</p>
    </div>
  );
}
