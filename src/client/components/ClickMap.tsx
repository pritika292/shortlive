import { useEffect, useRef } from "react";
import L from "leaflet";
import type { ClickEvent } from "../hooks/useShortliveClicks.js";
import { useTheme } from "../hooks/useTheme.js";

const PIN_LIFETIME_MS = 60_000;
const PRUNE_INTERVAL_MS = 5_000;

interface TrackedPin {
  marker: L.CircleMarker;
  bornAt: number;
  click: ClickEvent;
}

interface Props {
  points: ClickEvent[];
  hydrated: boolean;
  // When non-empty, points whose country is not in this set fade out.
  filteredCountries?: Set<string>;
}

const TILE_LIGHT = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export function ClickMap({ points, hydrated, filteredCountries }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const pinsRef = useRef<Map<number, TrackedPin>>(new Map());
  const seenIdsRef = useRef<Set<number>>(new Set());
  const hydratedAppliedRef = useRef(false);
  const { resolved } = useTheme();

  // One-time map setup.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 2,
      worldCopyJump: true,
      zoomControl: false,
      attributionControl: true,
    });
    map.attributionControl?.setPrefix("");
    tileLayerRef.current = L.tileLayer(resolved === "dark" ? TILE_DARK : TILE_LIGHT, {
      maxZoom: 18,
      attribution: TILE_ATTRIBUTION,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      pinsRef.current.clear();
      seenIdsRef.current.clear();
      hydratedAppliedRef.current = false;
    };
    // Only run on mount/unmount; the tile swap below handles theme changes.
  }, []);

  // Swap tile layer when the resolved theme changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(resolved === "dark" ? TILE_DARK : TILE_LIGHT, {
      maxZoom: 18,
      attribution: TILE_ATTRIBUTION,
    }).addTo(map);
  }, [resolved]);

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

  // Apply country filter — pins outside the filter set get dimmed instead of
  // removed so reactivating a filter brings them right back.
  useEffect(() => {
    for (const tracked of pinsRef.current.values()) {
      applyMarkerStyle(tracked, filteredCountries);
    }
  }, [filteredCountries]);

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
          applyMarkerStyle(p, filteredCountries);
        }
      }
    }, PRUNE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [filteredCountries]);

  return (
    <div
      ref={containerRef}
      className="h-80 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900"
    />
  );
}

function applyMarkerStyle(tracked: TrackedPin, filter?: Set<string>): void {
  const age = Date.now() - tracked.bornAt;
  const ageFactor = Math.max(0.05, 1 - age / PIN_LIFETIME_MS);
  const inFilter =
    !filter ||
    filter.size === 0 ||
    (tracked.click.country !== null && filter.has(tracked.click.country));
  const fillOpacity = inFilter ? ageFactor * 0.5 : 0.05;
  const opacity = inFilter ? ageFactor * 0.7 : 0.15;
  tracked.marker.setStyle({ fillOpacity, opacity });
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
    radius: 4,
    color: "#38bdf8",
    fillColor: "#38bdf8",
    fillOpacity: 0.35,
    weight: 1,
    opacity: 0.55,
  });
  marker.addTo(map);
  pins.set(click.ts, { marker, bornAt: Date.now(), click });
}
