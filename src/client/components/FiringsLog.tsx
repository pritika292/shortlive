import { useEffect, useState, useCallback } from "react";
import { fetchFirings, retryFiring, type Firing } from "../hooks/useRules.js";

function statusColor(s: Firing["status"]): string {
  if (s === "delivered") return "text-emerald-400";
  if (s === "failed") return "text-rose-400";
  return "text-amber-400";
}

interface Props {
  short: string;
  ruleId: string;
}

export function FiringsLog({ short, ruleId }: Props): JSX.Element {
  const [firings, setFirings] = useState<Firing[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const f = await fetchFirings(short, ruleId);
    setFirings(f);
  }, [short, ruleId]);

  useEffect(() => {
    void load();
    const id = setInterval(load, 5_000);
    return () => clearInterval(id);
  }, [load]);

  async function onRetry(fid: string): Promise<void> {
    setRetrying(fid);
    try {
      await retryFiring(short, ruleId, fid);
      await load();
    } finally {
      setRetrying(null);
    }
  }

  if (firings.length === 0) {
    return <div className="text-xs text-slate-500">No firings yet.</div>;
  }

  return (
    <table className="w-full text-xs">
      <thead className="text-xs uppercase tracking-wider text-slate-500">
        <tr>
          <th className="text-left pb-1 font-normal">When</th>
          <th className="text-left pb-1 font-normal">Status</th>
          <th className="text-right pb-1 font-normal">Attempts</th>
          <th className="text-right pb-1 font-normal">Last code</th>
          <th className="text-right pb-1 font-normal w-20" />
        </tr>
      </thead>
      <tbody className="text-slate-700 dark:text-slate-300">
        {firings.map((f) => (
          <tr key={f.id} className="border-t border-slate-200 dark:border-slate-800">
            <td className="py-1 tabular-nums">{new Date(f.ts).toLocaleTimeString()}</td>
            <td className={`py-1 ${statusColor(f.status)}`}>{f.status}</td>
            <td className="py-1 text-right tabular-nums">{f.attempts}</td>
            <td className="py-1 text-right tabular-nums text-slate-500 dark:text-slate-400">
              {f.last_response_code ?? "—"}
            </td>
            <td className="py-1 text-right">
              {f.status === "failed" ? (
                <button
                  type="button"
                  disabled={retrying === f.id}
                  onClick={() => void onRetry(f.id)}
                  className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 disabled:opacity-50"
                >
                  {retrying === f.id ? "retrying…" : "retry"}
                </button>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
