import { useState } from "react";
import { useRules, deleteRule, patchRule, reVerifyRule, type Rule } from "../hooks/useRules.js";
import { RuleForm } from "../components/RuleForm.js";
import { FiringsLog } from "../components/FiringsLog.js";
import { TopBar } from "../components/TopBar.js";
import { Footer } from "../components/Footer.js";

interface Props {
  short: string;
}

export function RulesPage({ short }: Props): JSX.Element {
  const { rules, loading, error, refresh } = useRules(short);

  return (
    <>
      <TopBar current="rules" />
      <main className="relative min-h-[calc(100vh-72px)] max-w-5xl mx-auto px-6 lg:px-8 py-10">
        <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              Rules
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">
              Configure webhooks that fire when click patterns match{" "}
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                /{short}
              </span>
              .
            </p>
          </div>
          <a href={`/a/${short}`} className="btn-secondary">
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
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Analytics
          </a>
        </header>

        <section className="mb-10">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" />
              <div className="text-xs uppercase tracking-[0.18em] font-semibold text-slate-500 dark:text-slate-400">
                Create a rule
              </div>
            </div>
            <RuleForm short={short} onCreated={refresh} />
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3 mb-5">
            <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" />
            <div className="text-xs uppercase tracking-[0.18em] font-semibold text-slate-500 dark:text-slate-400">
              Existing rules
            </div>
          </div>
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 px-4 py-2.5 text-sm">
              {error}
            </div>
          )}
          {loading && <div className="text-sm text-slate-500">Loading…</div>}
          {!loading && rules.length === 0 && (
            <div className="glass-card p-8 text-center text-slate-500">
              No rules yet. Create one above to get started.
            </div>
          )}
          <div className="grid gap-4">
            {rules.map((r) => (
              <RuleCard key={r.id} short={short} rule={r} onChange={refresh} />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function RuleCard({
  short,
  rule,
  onChange,
}: {
  short: string;
  rule: Rule;
  onChange: () => Promise<void>;
}): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [showFirings, setShowFirings] = useState(false);

  async function toggleEnabled(): Promise<void> {
    setBusy(true);
    try {
      await patchRule(short, rule.id, { enabled: !rule.enabled });
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(): Promise<void> {
    setBusy(true);
    try {
      await reVerifyRule(short, rule.id);
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(): Promise<void> {
    if (!confirm(`Delete rule ${rule.id}?`)) return;
    setBusy(true);
    try {
      await deleteRule(short, rule.id);
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-500/15 to-cyan-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              {rule.type}
            </span>
            <span className="font-mono text-xs text-slate-500">{rule.id}</span>
          </div>
        </div>
        <VerifiedBadge verified={rule.destination_verified} />
      </div>

      <div className="text-sm font-mono text-slate-700 dark:text-slate-200 mb-2 break-all bg-slate-50 dark:bg-white/[0.03] rounded-lg px-3 py-2">
        {rule.destination_url}
      </div>
      <div className="text-xs text-slate-500 mb-4">
        config:{" "}
        <code className="text-slate-600 dark:text-slate-300">{JSON.stringify(rule.config)}</code>
        {" · "}
        cooldown {rule.cooldown_seconds}s
        {rule.last_fired_at ? ` · last fired ${new Date(rule.last_fired_at).toLocaleString()}` : ""}
      </div>
      {rule.last_verification_error && (
        <div className="text-xs text-rose-500 dark:text-rose-400 mb-3">
          Verification: {rule.last_verification_error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        <RuleButton onClick={() => void toggleEnabled()} disabled={busy}>
          {rule.enabled ? "Disable" : "Enable"}
        </RuleButton>
        <RuleButton onClick={() => void onVerify()} disabled={busy}>
          Re-verify
        </RuleButton>
        <RuleButton onClick={() => setShowFirings((v) => !v)}>
          {showFirings ? "Hide firings" : "Show firings"}
        </RuleButton>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onDelete()}
          className="ml-auto inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      {showFirings && (
        <div className="mt-5 pt-5 border-t border-slate-200/60 dark:border-white/5">
          <FiringsLog short={short} ruleId={rule.id} />
        </div>
      )}
    </div>
  );
}

function RuleButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function VerifiedBadge({ verified }: { verified: boolean }): JSX.Element {
  return verified ? (
    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
      Unverified
    </span>
  );
}
