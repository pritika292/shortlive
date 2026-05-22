import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClickEvent } from "./useShortliveClicks.js";
import { buildSeedClicks, makeLiveClick } from "../lib/demoSeed.ts";

// One synthetic click every 0.1-1 second for 60s. The user presses the
// button, the counter resets to 0, and they watch it climb in real time.
// At mean ~0.55s per click we land ~110 events in the 60s window which is
// enough to fill a per-second chart organically.
const BURST_DURATION_MS = 60_000;
const MIN_GAP_MS = 100;
const MAX_GAP_MS = 1_000;

// Page-load seed: ~80 clicks across the last minute so the per-second chart
// and breakdowns aren't empty before the demo button is pressed.
const SEED_COUNT = 80;
const SEED_WINDOW_MS = 60_000;

export interface DemoSimulatorState {
  // The full list of synthetic clicks (newest first). The dashboard reads
  // this for the recent feed, map pins, chart, and breakdowns.
  events: ClickEvent[];
  // Number of clicks generated during the active burst. Resets to 0 each
  // time the user presses the button. While idle, mirrors events.length so
  // the unfiltered counter shows the full seeded dataset.
  total: number;
  running: boolean;
  startBurst: () => void;
  // Seconds remaining in the current burst (0 when idle).
  remainingSeconds: number;
}

interface RunState {
  startedAt: number;
  fired: number;
}

export function useDemoSimulator(): DemoSimulatorState {
  // Seed is computed once on mount.
  const initialSeed = useMemo(() => buildSeedClicks(SEED_COUNT, SEED_WINDOW_MS), []);
  const [events, setEvents] = useState<ClickEvent[]>(initialSeed);
  const [running, setRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Active-burst state lives in a ref so we don't churn renders on each click.
  const runRef = useRef<RunState | null>(null);
  // Timeout/interval handles for cleanup.
  const tickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopBurst = useCallback(() => {
    if (tickTimer.current) {
      clearTimeout(tickTimer.current);
      tickTimer.current = null;
    }
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
    runRef.current = null;
    setRunning(false);
    setRemainingSeconds(0);
  }, []);

  const scheduleNext = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    const elapsed = Date.now() - run.startedAt;
    if (elapsed >= BURST_DURATION_MS) {
      stopBurst();
      return;
    }
    const gap = MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);
    tickTimer.current = setTimeout(() => {
      const click = makeLiveClick();
      setEvents((prev) => [click, ...prev]);
      if (runRef.current) runRef.current.fired++;
      scheduleNext();
    }, gap);
  }, [stopBurst]);

  const startBurst = useCallback(() => {
    if (runRef.current) return; // already running
    // Zero everything out: counter, chart, breakdowns, recent feed, and map
    // pins all derive from `events`, so emptying it gives the user the
    // "watch a fresh dashboard fill in front of you" moment the button
    // promises. The bundled seed was only there to make the cold load look
    // populated.
    setEvents([]);
    runRef.current = { startedAt: Date.now(), fired: 0 };
    setRunning(true);
    setRemainingSeconds(Math.ceil(BURST_DURATION_MS / 1000));
    countdownTimer.current = setInterval(() => {
      const run = runRef.current;
      if (!run) return;
      const remaining = Math.max(0, BURST_DURATION_MS - (Date.now() - run.startedAt));
      setRemainingSeconds(Math.ceil(remaining / 1000));
    }, 250);
    scheduleNext();
  }, [scheduleNext]);

  useEffect(() => stopBurst, [stopBurst]);

  // When a burst is active, the displayed "total" should be the number of
  // clicks generated during this session (so the user watches it climb from
  // 0). When idle, the counter shows the full event list so the page looks
  // populated.
  const total = running ? (runRef.current?.fired ?? 0) : events.length;

  return { events, total, running, startBurst, remainingSeconds };
}
