import { useState } from "react";
import { createRule } from "../hooks/useRules.js";

type RuleType = "threshold" | "velocity" | "first_of" | "per_click";

interface Props {
  short: string;
  onCreated: () => void;
}

const inputClass =
  "bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500";
const labelClass =
  "text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400";

export function RuleForm({ short, onCreated }: Props): JSX.Element {
  const [type, setType] = useState<RuleType>("threshold");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [cooldown, setCooldown] = useState(60);
  const [count, setCount] = useState(5);
  const [windowSec, setWindowSec] = useState(30);
  const [dimension, setDimension] = useState<"country" | "device" | "referrer">("country");
  const [countriesText, setCountriesText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        type,
        destination_url: destinationUrl,
        cooldown_seconds: cooldown,
      };
      if (type === "threshold") body.config = { count };
      else if (type === "velocity") body.config = { count, window_seconds: windowSec };
      else if (type === "first_of") body.config = { dimension };
      else
        body.config = {
          filters: {
            country: countriesText
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          },
        };

      const res = await createRule(short, body);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? `HTTP ${res.status}`);
        return;
      }
      setDestinationUrl("");
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-1.5">
        <label htmlFor="rule-type" className={labelClass}>
          Type
        </label>
        <select
          id="rule-type"
          value={type}
          onChange={(e) => setType(e.target.value as RuleType)}
          className={inputClass}
        >
          <option value="threshold">threshold: fire once at N total clicks</option>
          <option value="velocity">velocity: fire when N clicks land in T seconds</option>
          <option value="first_of">first_of: fire on each new dimension value</option>
          <option value="per_click">per_click: fire on every matching click</option>
        </select>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="rule-destination" className={labelClass}>
          Destination URL
        </label>
        <input
          id="rule-destination"
          type="url"
          required
          placeholder="https://your-receiver.example/webhook"
          value={destinationUrl}
          onChange={(e) => setDestinationUrl(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {(type === "threshold" || type === "velocity") && (
          <div className="grid gap-1.5">
            <label htmlFor="rule-count" className={labelClass}>
              Count (N)
            </label>
            <input
              id="rule-count"
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className={inputClass}
            />
          </div>
        )}
        {type === "velocity" && (
          <div className="grid gap-1.5">
            <label htmlFor="rule-window" className={labelClass}>
              Window (seconds)
            </label>
            <input
              id="rule-window"
              type="number"
              min={1}
              value={windowSec}
              onChange={(e) => setWindowSec(Number(e.target.value))}
              className={inputClass}
            />
          </div>
        )}
        {type === "first_of" && (
          <div className="grid gap-1.5">
            <label htmlFor="rule-dimension" className={labelClass}>
              Dimension
            </label>
            <select
              id="rule-dimension"
              value={dimension}
              onChange={(e) => setDimension(e.target.value as typeof dimension)}
              className={inputClass}
            >
              <option value="country">country</option>
              <option value="device">device</option>
              <option value="referrer">referrer</option>
            </select>
          </div>
        )}
        {type === "per_click" && (
          <div className="grid gap-1.5 sm:col-span-2">
            <label htmlFor="rule-countries" className={labelClass}>
              Countries (comma-separated ISO codes)
            </label>
            <input
              id="rule-countries"
              type="text"
              placeholder="US, DE, IN"
              value={countriesText}
              onChange={(e) => setCountriesText(e.target.value)}
              className={inputClass}
            />
          </div>
        )}
        <div className="grid gap-1.5">
          <label htmlFor="rule-cooldown" className={labelClass}>
            Cooldown (seconds)
          </label>
          <input
            id="rule-cooldown"
            type="number"
            min={0}
            value={cooldown}
            onChange={(e) => setCooldown(Number(e.target.value))}
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 px-4 py-2.5 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !destinationUrl}
        className="btn-primary self-start disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Creating…" : "Create rule"}
      </button>
    </form>
  );
}
