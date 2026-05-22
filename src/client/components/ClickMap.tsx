import { useEffect, useRef } from "react";
import L from "leaflet";
import type { ClickEvent } from "../hooks/useShortliveClicks.js";

const PIN_LIFETIME_MS = 60_000;
const PRUNE_INTERVAL_MS = 5_000;

interface TrackedPin {
  marker: L.CircleMarker;
  bornAt: number;
}

interface Props {
  points: ClickEvent[];
  hydrated: boolean;
}

export function ClickMap({ points, hydrated }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinsRef = useRef<Map<number, TrackedPin>>(new Map());
  const seenIdsRef = useRef<Set<number>>(new Set());
  const hydratedAppliedRef = useRef(false);

  // One-time map setup.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 2,
      worldCopyJump: true,
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      // OSM tiles are free; the attribution belongs in a footer rather than the
      // tile layer to keep the demo clean.
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      pinsRef.current.clear();
      seenIdsRef.current.clear();
      hydratedAppliedRef.current = false;
    };
  }, []);

  // Add hydration pins once.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hydrated || hydratedAppliedRef.current) return;
    hydratedAppliedRef.current = true;
    for (const c of points) {
      addPin(map, pinsRef.current, seenIdsRef.current, c);
    }
  }, [hydrated, points]);

  // Add a pin whenever a new click arrives (post-hydration).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hydratedAppliedRef.current) return;
    const latest = points[0];
    if (!latest) return;
    addPin(map, pinsRef.current, seenIdsRef.current, latest);
  }, [points]);

  // Prune pins past their lifetime.
  useEffect(() => {
    const id = setInterval(() => {
      const map = mapRef.current;
      if (!map) return;
      const cutoff = Date.now() - PIN_LIFETIME_MS;
      for (const [key, p] of pinsRef.current) {
        if (p.bornAt < cutoff) {
          map.removeLayer(p.marker);
          pinsRef.current.delete(key);
        } else {
          // Fade as it ages.
          const age = Date.now() - p.bornAt;
          const opacity = Math.max(0.05, 1 - age / PIN_LIFETIME_MS);
          p.marker.setStyle({ fillOpacity: opacity * 0.7, opacity });
        }
      }
    }, PRUNE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return <div ref={containerRef} className="h-72 rounded-lg overflow-hidden bg-slate-900" />;
}

function addPin(
  map: L.Map,
  pins: Map<number, TrackedPin>,
  seen: Set<number>,
  click: ClickEvent,
): void {
  if (click.lat === null || click.lon === null) return;
  if (seen.has(click.ts)) return;
  seen.add(click.ts);
  const marker = L.circleMarker([click.lat, click.lon], {
    radius: 6,
    color: "#38bdf8",
    fillColor: "#38bdf8",
    fillOpacity: 0.7,
    weight: 1,
  });
  marker.addTo(map);
  pins.set(click.ts, { marker, bornAt: Date.now() });
}
