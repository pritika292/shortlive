interface Props {
  running: boolean;
  remainingSeconds: number;
  onStart: () => void;
}

export function RunDemoButton({ running, remainingSeconds, onStart }: Props): JSX.Element {
  return (
    <button
      type="button"
      onClick={onStart}
      disabled={running}
      className={
        "relative inline-flex items-center gap-2.5 px-6 py-3 rounded-full text-sm font-semibold text-white transition-all focus:outline-none focus:ring-4 " +
        (running
          ? "bg-gradient-to-r from-rose-500 to-red-500 shadow-lg shadow-rose-500/40 focus:ring-rose-500/30 cursor-not-allowed run-demo--running"
          : "bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/40 hover:shadow-emerald-500/60 focus:ring-emerald-500/30 cursor-pointer run-demo--idle")
      }
    >
      <span aria-hidden className={"relative inline-flex h-2.5 w-2.5 " + (running ? "" : "")}>
        <span
          className={
            "absolute inset-0 rounded-full opacity-75 animate-ping " +
            (running ? "bg-white" : "bg-white")
          }
        />
        <span className="relative inline-block h-2.5 w-2.5 rounded-full bg-white" />
      </span>
      {running ? (
        <>
          <span>Running demo</span>
          <span className="tabular-nums opacity-80">· {remainingSeconds}s</span>
        </>
      ) : (
        <span>Start demo</span>
      )}
    </button>
  );
}
