import { useEffect, useMemo, useRef, useState } from "react";
import type { ClickEvent } from "./useShortliveClicks.js";

// Mirrors the four rule types the real server supports, minus per_click (no
// filter set to demo). Each rule has a human-readable description, a fake
// destination URL (decorative), and a state that the panel renders.

export type RuleType = "threshold" | "velocity" | "first_of";

export interface DemoRule {
  id: string;
  type: RuleType;
  name: string;
  description: string;
  destination: string;
  fireCount: number;
  state: "armed" | "cooling" | "fired";
  cooldownRemaining?: number;
}

export interface DemoFiring {
  id: string;
  ts: number;
  ruleId: string;
  ruleName: string;
  matchedValue?: string;
  status: "delivered" | "retried" | "failed";
  httpCode: number;
  latencyMs: number;
  attempts: number;
}

// Tuned so a 60s burst with ~110 clicks lands a believable number of fires
// across the three types (~1 threshold, 2-3 velocity, 5-8 first_of).
const THRESHOLD_N = 25;
const VELOCITY_WINDOW_MS = 10_000;
const VELOCITY_N = 8;
const VELOCITY_COOLDOWN_MS = 12_000;

const RULES_CONFIG: Omit<DemoRule, "fireCount" | "state" | "cooldownRemaining">[] = [
  {
    id: "demo-threshold",
    type: "threshold",
    name: "Threshold",
    description: `Fire once at ${THRESHOLD_N} clicks`,
    destination: "https://hooks.example.com/launch-alert",
  },
  {
    id: "demo-velocity",
    type: "velocity",
    name: "Velocity",
    description: `Fire when ≥ ${VELOCITY_N} clicks land in ${Math.round(VELOCITY_WINDOW_MS / 1000)}s`,
    destination: "https://hooks.example.com/spike-detector",
  },
  {
    id: "demo-first-of",
    type: "first_of",
    name: "First of country",
    description: "Fire on the first click from each new country",
    destination: "https://hooks.example.com/new-region",
  },
];

interface InternalState {
  lastEventCount: number;
  thresholdFired: boolean;
  velocityFireCount: number;
  velocityLastFiredAt: number;
  firstOfSeen: Set<string>;
  fireCounts: Record<string, number>;
  firings: DemoFiring[];
  firingIdCounter: number;
}

function freshState(): InternalState {
  return {
    lastEventCount: 0,
    thresholdFired: false,
    velocityFireCount: 0,
    velocityLastFiredAt: 0,
    firstOfSeen: new Set(),
    fireCounts: { "demo-threshold": 0, "demo-velocity": 0, "demo-first-of": 0 },
    firings: [],
    firingIdCounter: 0,
  };
}

function mockLatency(): number {
  // 80-260 ms, biased toward the lower end.
  return Math.round(80 + Math.random() * 180);
}

function mockStatus(): { status: DemoFiring["status"]; httpCode: number; attempts: number } {
  // 1 in 12 firings shows a retry to make the resilience pitch visible.
  if (Math.random() < 1 / 12) {
    return { status: "retried", httpCode: 200, attempts: 2 };
  }
  return { status: "delivered", httpCode: 200, attempts: 1 };
}

const MAX_FIRINGS_LOG = 20;

export interface UseDemoRulesState {
  rules: DemoRule[];
  firings: DemoFiring[];
}

// Watches the demo simulator's event stream and fires demo rules whose
// conditions match. State is reset whenever the events array shrinks (the
// simulator clears it at the start of each burst).
export function useDemoRules(events: ClickEvent[], now: number): UseDemoRulesState {
  const internal = useRef<InternalState>(freshState());
  // Trigger a re-render whenever internal state mutates. The actual data
  // lives in the ref; this counter is just a useState bumper.
  const [tick, setTick] = useState(0);
  const bump = (): void => setTick((t) => t + 1);

  useEffect(() => {
    const s = internal.current;

    // Reset on simulator restart (events array shrinks back toward zero).
    if (events.length < s.lastEventCount) {
      internal.current = freshState();
      bump();
      return;
    }

    if (events.length === s.lastEventCount) return;

    // Process events newest-first in the array, but we want oldest-first
    // for state-machine evaluation. Take the slice of new events and walk.
    const newCount = events.length - s.lastEventCount;
    const newEvents = events.slice(0, newCount).reverse();

    let mutated = false;

    for (const e of newEvents) {
      // Threshold: fires once when the total reaches N.
      if (!s.thresholdFired && events.length - newCount + newEvents.indexOf(e) + 1 >= THRESHOLD_N) {
        s.thresholdFired = true;
        s.fireCounts["demo-threshold"] = (s.fireCounts["demo-threshold"] ?? 0) + 1;
        pushFiring(s, "demo-threshold", "Threshold", e.ts, undefined);
        mutated = true;
      }

      // First of country: fire on the first click from each new country.
      if (e.country && !s.firstOfSeen.has(e.country)) {
        s.firstOfSeen.add(e.country);
        s.fireCounts["demo-first-of"] = (s.fireCounts["demo-first-of"] ?? 0) + 1;
        pushFiring(s, "demo-first-of", "First of country", e.ts, e.country);
        mutated = true;
      }
    }

    // Velocity: re-evaluate after the batch. Count events in the last
    // VELOCITY_WINDOW_MS; if >= N and cooldown elapsed, fire.
    const cutoff = (events[0]?.ts ?? Date.now()) - VELOCITY_WINDOW_MS;
    let inWindow = 0;
    for (const e of events) {
      if (e.ts >= cutoff) inWindow++;
      else break; // events are newest-first, so we can stop early
    }
    const sinceLast = (events[0]?.ts ?? Date.now()) - s.velocityLastFiredAt;
    if (inWindow >= VELOCITY_N && sinceLast >= VELOCITY_COOLDOWN_MS) {
      s.velocityFireCount++;
      s.velocityLastFiredAt = events[0]?.ts ?? Date.now();
      s.fireCounts["demo-velocity"] = (s.fireCounts["demo-velocity"] ?? 0) + 1;
      pushFiring(
        s,
        "demo-velocity",
        "Velocity",
        events[0]?.ts ?? Date.now(),
        `${inWindow}/${VELOCITY_WINDOW_MS / 1000}s`,
      );
      mutated = true;
    }

    s.lastEventCount = events.length;
    if (mutated) bump();
  }, [events.length]);

  // Build the rules array each render so the cooldown timer ticks live.
  const rules = useMemo<DemoRule[]>(() => {
    const s = internal.current;
    return RULES_CONFIG.map((cfg) => {
      const fireCount = s.fireCounts[cfg.id] ?? 0;
      let state: DemoRule["state"] = "armed";
      let cooldownRemaining: number | undefined;
      if (cfg.id === "demo-threshold" && s.thresholdFired) {
        state = "fired";
      } else if (cfg.id === "demo-velocity") {
        const sinceLast = now - s.velocityLastFiredAt;
        if (s.velocityLastFiredAt > 0 && sinceLast < VELOCITY_COOLDOWN_MS) {
          state = "cooling";
          cooldownRemaining = Math.ceil((VELOCITY_COOLDOWN_MS - sinceLast) / 1000);
        }
      }
      return { ...cfg, fireCount, state, cooldownRemaining };
    });
    // tick is read so React re-renders when internal mutates
  }, [tick, now]);

  return { rules, firings: internal.current.firings };
}

function pushFiring(
  s: InternalState,
  ruleId: string,
  ruleName: string,
  ts: number,
  matchedValue: string | undefined,
): void {
  const { status, httpCode, attempts } = mockStatus();
  s.firingIdCounter++;
  s.firings.unshift({
    id: `fire-${s.firingIdCounter}`,
    ts,
    ruleId,
    ruleName,
    matchedValue,
    status,
    httpCode,
    latencyMs: mockLatency(),
    attempts,
  });
  if (s.firings.length > MAX_FIRINGS_LOG) {
    s.firings.length = MAX_FIRINGS_LOG;
  }
}
