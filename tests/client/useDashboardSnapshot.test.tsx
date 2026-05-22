import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useDashboardSnapshot,
  _clearSnapshotCache,
} from "../../src/client/hooks/useDashboardSnapshot.js";

function snapshotBody(label: string): unknown {
  return {
    short: "demo",
    series: [{ ts: 1, count: 1 }],
    breakdowns: {
      country: { total: 1, rows: [{ value: label, count: 1, percent: 100 }] },
      device: { total: 0, rows: [] },
      referrer: { total: 0, rows: [] },
    },
  };
}

describe("useDashboardSnapshot", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    _clearSnapshotCache();
    fetchSpy = vi.spyOn(global, "fetch");
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    vi.useRealTimers();
  });

  it("debounces rapid filter toggles into one fetch", async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(snapshotBody("US")), { status: 200 }));

    const { rerender } = renderHook(({ filters }) => useDashboardSnapshot("demo", 0, filters), {
      initialProps: { filters: { countries: ["US"] } as { countries: string[] } },
    });

    // Toggle the filter three times within the debounce window.
    rerender({ filters: { countries: ["DE"] } });
    rerender({ filters: { countries: ["GB"] } });
    rerender({ filters: { countries: ["FR"] } });

    // No fetch yet (debounce hasn't elapsed).
    expect(fetchSpy).toHaveBeenCalledTimes(0);

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    // Only the last filter state fired.
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toMatch(/country=FR/);
  });

  it("serves repeat filter sets from the in-memory cache", async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(snapshotBody("US")), { status: 200 }));

    const { rerender } = renderHook(({ filters }) => useDashboardSnapshot("demo", 0, filters), {
      initialProps: { filters: { countries: ["US"] } as { countries: string[] } },
    });

    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    // Toggle away then back. The "back" state should hit the cache, no new fetch.
    rerender({ filters: { countries: ["DE"] } });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));

    rerender({ filters: { countries: ["US"] } });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    // Still 2: the US fetch is cached.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
