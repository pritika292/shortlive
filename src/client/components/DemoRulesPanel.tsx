import type { DemoRule, DemoFiring } from "../hooks/useDemoRules.js";

interface Props {
  rules: DemoRule[];
  firings: DemoFiring[];
  now: number;
}

const TYPE_BADGE: Record<DemoRule["type"], string> = {
  threshold: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  velocity: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  first_of: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
};

export function DemoRulesPanel({ rules, firings, now }: Props): JSX.Element {
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        When clicks match a rule, shortlive POSTs to your endpoint with an HMAC-signed payload.
        Failures retry with exponential backoff; dead-letter on the fifth try. The three rules below
        are pre-configured for the demo and fire as the burst runs.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {rules.map((r) => (
          <RuleCard key={r.id} rule={r} />
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs uppercase tracking-[0.18em] font-semibold text-slate-500 dark:text-slate-400">
            Recent firings
          </h3>
          <span className="text-xs text-slate-500">
            {firings.length === 0 ? "none yet" : `${firings.length} total`}
          </span>
        </div>
        <FiringsLog firings={firings} now={now} />
      </div>
    </div>
  );
}

function RuleCard({ rule }: { rule: DemoRule }): JSX.Element {
  const stateColor =
    rule.state === "fired"
      ? "bg-emerald-500"
      : rule.state === "cooling"
        ? "bg-amber-500"
        : "bg-slate-400 dark:bg-slate-500";
  const stateLabel =
    rule.state === "fired"
      ? "Fired"
      : rule.state === "cooling"
        ? `Cooling ${rule.cooldownRemaining ?? 0}s`
        : "Armed";

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${TYPE_BADGE[rule.type]}`}
        >
          {rule.type}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${stateColor}`} aria-hidden />
          {stateLabel}
        </span>
      </div>
      <div>
        <div className="font-semibold text-slate-900 dark:text-white">{rule.name}</div>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{rule.description}</p>
      </div>
      <div className="rounded-lg bg-slate-100/70 dark:bg-white/[0.03] px-3 py-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate">
        {rule.destination}
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3 text-emerald-500"
            aria-hidden
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          HMAC verified
        </span>
        <span className="tabular-nums">
          {rule.fireCount} fire{rule.fireCount === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

function FiringsLog({ firings, now }: { firings: DemoFiring[]; now: number }): JSX.Element {
  if (firings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300/70 dark:border-white/10 p-6 text-center text-sm text-slate-500">
        No firings yet. Start the demo above and watch rules trigger live.
      </div>
    );
  }
  return (
    <ul className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] divide-y divide-slate-200/60 dark:divide-white/5 overflow-hidden">
      {firings.map((f) => (
        <li
          key={f.id}
          className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-white/[0.02]"
        >
          <FiringStatus status={f.status} httpCode={f.httpCode} attempts={f.attempts} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <span className="font-semibold truncate">{f.ruleName}</span>
              {f.matchedValue ? (
                <span className="font-mono text-xs text-slate-500 truncate">
                  matched: {f.matchedValue}
                </span>
              ) : null}
            </div>
            <div className="text-[11px] text-slate-500 tabular-nums">
              {relativeTime(f.ts, now)} · {f.latencyMs} ms · {f.attempts}{" "}
              {f.attempts === 1 ? "attempt" : "attempts"}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function FiringStatus({
  status,
  httpCode,
  attempts,
}: {
  status: DemoFiring["status"];
  httpCode: number;
  attempts: number;
}): JSX.Element {
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 h-7 px-2 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 shrink-0">
        Failed {httpCode}
      </span>
    );
  }
  if (status === "retried" || attempts > 1) {
    return (
      <span className="inline-flex items-center gap-1 h-7 px-2 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
        Retried → {httpCode}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 h-7 px-2 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
      {httpCode} OK
    </span>
  );
}

function relativeTime(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  if (diff < 2_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / (60 * 60_000))}h ago`;
}
