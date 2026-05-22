import { useEffect, useState } from "react";

export function LiveCounter({ count }: { count: number }): JSX.Element {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (count === 0) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 400);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <div className={`transition-colors ${pulse ? "text-sky-400" : "text-slate-100"}`}>
      <div className="text-4xl font-semibold tabular-nums">{count.toLocaleString()}</div>
    </div>
  );
}
