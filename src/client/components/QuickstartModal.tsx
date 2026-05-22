import { useState } from "react";

interface Props {
  next: string;
  onClose: () => void;
}

export function QuickstartModal({ next, onClose }: Props): JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/quickstart", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        if (res.status === 429) {
          setError("The playground is full right now. Try again in a minute.");
        } else {
          setError(`Couldn't start a playground (HTTP ${res.status}).`);
        }
        return;
      }
      window.location.assign(next);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quickstart-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={() => (submitting ? null : onClose())}
        aria-hidden
      />
      <div className="relative w-full max-w-md glass-card p-7 sm:p-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-100/80 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Heads up
        </div>
        <h2
          id="quickstart-title"
          className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-3"
        >
          This is a 30-minute playground.
        </h2>
        <p className="text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
          You can create links, fire clicks, and set up rules. After 30 minutes the playground
          session and everything you created in it (links, rules, click history) gets wiped.
        </p>
        <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1.5 mb-6">
          <li className="flex gap-2">
            <span aria-hidden className="text-emerald-500 mt-0.5">
              ✓
            </span>
            No email, no password, one click in.
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="text-emerald-500 mt-0.5">
              ✓
            </span>
            All your data is yours for the next 30 minutes.
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="text-amber-500 mt-0.5">
              ⚠
            </span>
            For real use, sign in with proper credentials instead.
          </li>
        </ul>

        {error ? (
          <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 px-4 py-2.5 text-sm mb-4">
            {error}
          </div>
        ) : null}

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void accept()}
            disabled={submitting}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Starting…" : "Start playground"}
          </button>
        </div>
      </div>
    </div>
  );
}
