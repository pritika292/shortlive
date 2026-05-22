import { useEffect, useState } from "react";

export function LiveCounter({ count }: { count: number }): JSX.Element {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (count === 0) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 500);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <div className="flex items-end justify-between gap-3">
      <div
        className={`text-5xl font-bold tabular-nums tracking-tight transition-colors ${
          pulse ? "text-emerald-500 dark:text-emerald-400" : "text-slate-900 dark:text-white"
        }`}
      >
        {count.toLocaleString()}
      </div>
      <div className="pb-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wider">
        all-time
      </div>
    </div>
  );
}
