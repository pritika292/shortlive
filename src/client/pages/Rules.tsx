import { useState } from "react";
import { useRules, deleteRule, patchRule, reVerifyRule, type Rule } from "../hooks/useRules.js";
import { RuleForm } from "../components/RuleForm.js";
import { FiringsLog } from "../components/FiringsLog.js";

interface Props {
  short: string;
}

export function RulesPage({ short }: Props): JSX.Element {
  const { rules, loading, error, refresh } = useRules(short);

  return (
    <main className="min-h-screen px-6 py-8 max-w-4xl mx-auto">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Rules · <span className="text-slate-400">{short}</span>
          </h1>
          <p className="text-sm text-slate-400">
            Configure webhooks that fire when click patterns match.
          </p>
        </div>
        <a href={`/a/${short}`} className="text-xs text-slate-500 hover:text-slate-300">
          ← analytics
        </a>
      </header>

      <section className="mb-8">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">Create a rule</div>
          <RuleForm short={short} onCreated={refresh} />
        </div>
      </section>

      <section>
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">Existing rules</div>
        {error && <div className="text-sm text-rose-400 mb-3">{error}</div>}
        {loading && <div className="text-sm text-slate-500">Loading…</div>}
        {!loading && rules.length === 0 && (
          <div className="text-sm text-slate-500">No rules yet.</div>
        )}
        <div className="grid gap-4">
          {rules.map((r) => (
            <RuleCard key={r.id} short={short} rule={r} onChange={refresh} />
          ))}
        </div>
      </section>
    </main>
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
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <span className="text-sky-400 font-medium">{rule.type}</span>
          <span className="text-xs text-slate-500 ml-2">{rule.id}</span>
        </div>
        <VerifiedBadge verified={rule.destination_verified} />
      </div>

      <div className="text-sm text-slate-300 mb-2 break-all">{rule.destination_url}</div>
      <div className="text-xs text-slate-500 mb-3">
        config: <code className="text-slate-400">{JSON.stringify(rule.config)}</code>
        {" · "}
        cooldown {rule.cooldown_seconds}s
        {rule.last_fired_at ? ` · last fired ${new Date(rule.last_fired_at).toLocaleString()}` : ""}
      </div>
      {rule.last_verification_error && (
        <div className="text-xs text-rose-400 mb-2">
          Verification: {rule.last_verification_error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs">
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggleEnabled()}
          className="text-slate-300 hover:text-slate-100 disabled:opacity-50"
        >
          {rule.enabled ? "disable" : "enable"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onVerify()}
          className="text-slate-300 hover:text-slate-100 disabled:opacity-50"
        >
          re-verify
        </button>
        <button
          type="button"
          onClick={() => setShowFirings((v) => !v)}
          className="text-slate-300 hover:text-slate-100"
        >
          {showFirings ? "hide firings" : "show firings"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onDelete()}
          className="text-rose-400 hover:text-rose-300 disabled:opacity-50 ml-auto"
        >
          delete
        </button>
      </div>

      {showFirings && (
        <div className="mt-4 pt-4 border-t border-slate-800">
          <FiringsLog short={short} ruleId={rule.id} />
        </div>
      )}
    </div>
  );
}

function VerifiedBadge({ verified }: { verified: boolean }): JSX.Element {
  return verified ? (
    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-700/50">
      verified
    </span>
  ) : (
    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-700/50">
      unverified
    </span>
  );
}
