import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDemoRules } from "../../src/client/hooks/useDemoRules.js";
import type { ClickEvent } from "../../src/client/hooks/useShortliveClicks.js";

function makeEvent(country: string, ts: number = Date.now()): ClickEvent {
  return { ts, country, lat: 0, lon: 0, device: "desktop", referrer: null };
}

describe("useDemoRules", () => {
  it("starts with all rules armed and no firings", () => {
    const { result } = renderHook(() => useDemoRules([], Date.now()));
    expect(result.current.firings).toHaveLength(0);
    expect(result.current.rules).toHaveLength(3);
    expect(result.current.rules.every((r) => r.state === "armed" || r.state === "cooling")).toBe(
      true,
    );
  });

  it("fires the threshold rule once when the click count crosses the threshold", () => {
    const now = Date.now();
    let events: ClickEvent[] = [];
    const { result, rerender } = renderHook(({ ev, n }) => useDemoRules(ev, n), {
      initialProps: { ev: events, n: now },
    });

    // Newest-first, 30 events all from one country so first_of only fires once.
    events = Array.from({ length: 30 }, (_, i) => makeEvent("US", now - i * 100));
    act(() => rerender({ ev: events, n: now }));

    const threshold = result.current.rules.find((r) => r.id === "demo-threshold");
    expect(threshold?.fireCount).toBeGreaterThanOrEqual(1);
    expect(threshold?.state).toBe("fired");
  });

  it("fires first_of once per new country", () => {
    const now = Date.now();
    const countries = ["US", "DE", "JP", "BR", "GB"];
    const events: ClickEvent[] = countries.map((c, i) => makeEvent(c, now - i * 50));
    const { result } = renderHook(() => useDemoRules(events, now));
    const firstOf = result.current.rules.find((r) => r.id === "demo-first-of");
    expect(firstOf?.fireCount).toBe(countries.length);
    // All firings include the matched country code.
    const firstOfFirings = result.current.firings.filter((f) => f.ruleId === "demo-first-of");
    expect(firstOfFirings.length).toBe(countries.length);
    expect(firstOfFirings.map((f) => f.matchedValue).sort()).toEqual([...countries].sort());
  });

  it("resets all rule state when the events array shrinks (burst restart)", () => {
    const now = Date.now();
    const events: ClickEvent[] = Array.from({ length: 30 }, (_, i) =>
      makeEvent("US", now - i * 100),
    );
    const { result, rerender } = renderHook(({ ev }) => useDemoRules(ev, now), {
      initialProps: { ev: events },
    });
    expect(result.current.rules.find((r) => r.id === "demo-threshold")?.fireCount).toBeGreaterThan(
      0,
    );

    // Simulate burst restart.
    act(() => rerender({ ev: [] }));
    // After reset everything is armed again with zero fires.
    expect(result.current.firings).toHaveLength(0);
    expect(result.current.rules.every((r) => r.fireCount === 0)).toBe(true);
  });
});
