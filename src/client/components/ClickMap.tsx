import { useEffect, useRef } from "react";
import L from "leaflet";
import type { ClickEvent } from "../hooks/useShortliveClicks.js";
import { useTheme } from "../hooks/useTheme.js";
import { CONTINENT_BOUNDS, continentOf, type ContinentCode } from "../lib/continents.js";

const PIN_LIFETIME_MS = 60_000;
const PRUNE_INTERVAL_MS = 5_000;

interface TrackedPin {
  marker: L.Marker;
  bornAt: number;
  click: ClickEvent;
}

interface Props {
  points: ClickEvent[];
  hydrated: boolean;
  // When non-empty, points whose country is not in this set are hidden, and
  // the map zooms to the bounding box of the surviving pins.
  filteredCountries?: Set<string>;
  // Active continent filters — used to compute the focus bounds even if no
  // country pins have arrived yet for that region.
  filteredContinents?: Set<ContinentCode>;
}

const TILE_LIGHT = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const WORLD_CENTER: L.LatLngExpression = [22, 8];
const WORLD_ZOOM = 2;

function makeBlinkingIcon(): L.DivIcon {
  return L.divIcon({
    className: "shortlive-pin",
    html: '<span class="shortlive-pin__dot"></span><span class="shortlive-pin__ring"></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export function ClickMap({
  points,
  hydrated,
  filteredCountries,
  filteredContinents,
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const pinsRef = useRef<Map<number, TrackedPin>>(new Map());
  const seenIdsRef = useRef<Set<number>>(new Set());
  const hydratedAppliedRef = useRef(false);
  const { resolved } = useTheme();

  // One-time map setup — all user interactions disabled so it stays focused
  // on whatever region is in view.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: WORLD_CENTER,
      zoom: WORLD_ZOOM,
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      touchZoom: false,
      keyboard: false,
    });
    map.attributionControl?.setPrefix("");
    tileLayerRef.current = L.tileLayer(resolved === "dark" ? TILE_DARK : TILE_LIGHT, {
      maxZoom: 18,
      attribution: TILE_ATTRIBUTION,
      noWrap: true,
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
  }, []);

  // Swap tile layer when the resolved theme changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(resolved === "dark" ? TILE_DARK : TILE_LIGHT, {
      maxZoom: 18,
      attribution: TILE_ATTRIBUTION,
      noWrap: true,
    }).addTo(map);
  }, [resolved]);

  // Add hydration pins once.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hydrated || hydratedAppliedRef.current) return;
    hydratedAppliedRef.current = true;
    for (const c of points) {
      addPin(map, pinsRef.current, seenIdsRef.current, c, filteredCountries);
    }
  }, [hydrated, points]);

  // Add a pin whenever a new click arrives (post-hydration).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hydratedAppliedRef.current) return;
    const latest = points[0];
    if (!latest) return;
    addPin(map, pinsRef.current, seenIdsRef.current, latest, filteredCountries);
  }, [points]);

  // Apply country/continent filter — pins outside the filter are removed
  // entirely and the map zooms to the active region.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const hasFilter =
      (filteredCountries && filteredCountries.size > 0) ||
      (filteredContinents && filteredContinents.size > 0);

    for (const [key, tracked] of pinsRef.current) {
      if (!pinMatchesFilter(tracked, filteredCountries)) {
        map.removeLayer(tracked.marker);
        pinsRef.current.delete(key);
      }
    }

    if (!hasFilter) {
      map.flyTo(WORLD_CENTER, WORLD_ZOOM, { animate: true, duration: 0.6 });
      return;
    }

    // Compute the bounds to fly to. Prefer the live pin bounds if we have any;
    // otherwise fall back to the union of the selected continent bounds.
    let bounds: L.LatLngBounds | null = null;
    for (const tracked of pinsRef.current.values()) {
      if (tracked.click.lat === null || tracked.click.lon === null) continue;
      const ll = L.latLng(tracked.click.lat, tracked.click.lon);
      if (bounds) bounds.extend(ll);
      else bounds = L.latLngBounds(ll, ll);
    }
    if (!bounds && filteredContinents && filteredContinents.size > 0) {
      for (const c of filteredContinents) {
        const b = CONTINENT_BOUNDS[c];
        const corner = L.latLngBounds([b[0], b[1]], [b[2], b[3]]);
        if (bounds) bounds.extend(corner);
        else bounds = corner;
      }
    }
    if (bounds) {
      map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 6, animate: true, duration: 0.7 });
    }
  }, [filteredCountries, filteredContinents]);

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
        }
      }
    }, PRUNE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-96 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-white/10"
    />
  );
}

function pinMatchesFilter(tracked: TrackedPin, filter?: Set<string>): boolean {
  if (!filter || filter.size === 0) return true;
  return tracked.click.country !== null && filter.has(tracked.click.country);
}

function addPin(
  map: L.Map,
  pins: Map<number, TrackedPin>,
  seen: Set<number>,
  click: ClickEvent,
  filter?: Set<string>,
): void {
  if (click.lat === null || click.lon === null) return;
  if (seen.has(click.ts)) return;
  seen.add(click.ts);
  const tracked: TrackedPin = {
    marker: L.marker([click.lat, click.lon], { icon: makeBlinkingIcon(), interactive: false }),
    bornAt: Date.now(),
    click,
  };
  // Only render the marker if it passes the active filter; otherwise still
  // track it so a filter clear reveals it.
  if (pinMatchesFilter(tracked, filter)) {
    tracked.marker.addTo(map);
  }
  pins.set(click.ts, tracked);

  // Also bias the continent filter case: if filter is set but the click
  // belongs to a non-filtered country, keep it out of the live render but
  // do not pollute the pin pool.
  if (!pinMatchesFilter(tracked, filter)) {
    pins.delete(click.ts);
  }
}
