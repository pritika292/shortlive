import { useMemo } from "react";
import { geoEqualEarth, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import worldAtlas from "world-atlas/countries-110m.json";
import type { ClickEvent } from "../hooks/useShortliveClicks.js";
import { CONTINENT_BOUNDS, COUNTRY_BOUNDS, type ContinentCode } from "../lib/continents.js";

// World renders at this size; the actual on-screen size is set by the wrapper
// via the SVG viewBox + preserveAspectRatio. Picked so the map fits a 16:9-ish
// card without distorting too much.
const WIDTH = 1000;
const HEIGHT = 520;

// geoEqualEarth gives the cleanest "designed" feel for a portfolio map. The
// scale value was picked empirically so the entire world fits the viewBox.
const PROJECTION = geoEqualEarth()
  .scale(190)
  .translate([WIDTH / 2, HEIGHT / 2]);
const PATH_GEN = geoPath(PROJECTION);

// Convert the topojson to GeoJSON once at module load. The world-atlas
// countries-110m file is ~108 KB raw / ~40 KB gzipped, baked into the bundle.
const TOPO = worldAtlas as unknown as Topology;
const COUNTRIES = feature(
  TOPO,
  TOPO.objects.countries as GeometryCollection,
) as FeatureCollection<Geometry>;

// Pre-compute the world outline as a single SVG path string. d3 fills it for
// us so we don't have to maintain any geo data ourselves.
const WORLD_PATH = COUNTRIES.features
  .map((f) => PATH_GEN(f))
  .filter((d): d is string => !!d)
  .join(" ");

interface Props {
  points: ClickEvent[];
  filteredCountries?: Set<string>;
  filteredContinents?: Set<ContinentCode>;
}

export function WorldMap({ points, filteredCountries, filteredContinents }: Props): JSX.Element {
  const viewBox = useMemo(
    () => computeViewBox(filteredCountries, filteredContinents),
    [filteredCountries, filteredContinents],
  );

  const visiblePoints = useMemo(() => {
    if (!filteredCountries || filteredCountries.size === 0) return points;
    return points.filter((p) => p.country && filteredCountries.has(p.country));
  }, [points, filteredCountries]);

  return (
    <div className="relative h-96 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950/60 ring-1 ring-slate-200 dark:ring-white/10">
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        aria-label="World map of recent clicks"
      >
        <defs>
          <radialGradient id="world-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(16,185,129,0.18)" />
            <stop offset="100%" stopColor="rgba(16,185,129,0)" />
          </radialGradient>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#world-glow)" opacity="0.6" />
        <path
          d={WORLD_PATH}
          className="fill-slate-300/70 dark:fill-white/[0.08] stroke-slate-400/30 dark:stroke-white/10"
          strokeWidth={0.4}
        />
        {visiblePoints.map((p, i) => {
          if (p.lat === null || p.lon === null) return null;
          const projected = PROJECTION([p.lon, p.lat]);
          if (!projected) return null;
          const [x, y] = projected;
          return (
            <g key={`${p.ts}-${i}`} transform={`translate(${x} ${y})`}>
              <circle r={3} fill="rgba(16,185,129,0.45)">
                <animate attributeName="r" values="3;14;3" dur="1.8s" repeatCount="indefinite" />
                <animate
                  attributeName="opacity"
                  values="0.6;0;0.6"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle r={3} fill="#10b981">
                <animate
                  attributeName="opacity"
                  values="1;0.5;1"
                  dur="1.4s"
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function computeViewBox(
  filteredCountries?: Set<string>,
  filteredContinents?: Set<ContinentCode>,
): string {
  const FULL = `0 0 ${WIDTH} ${HEIGHT}`;
  const hasFilter =
    (filteredCountries && filteredCountries.size > 0) ||
    (filteredContinents && filteredContinents.size > 0);
  if (!hasFilter) return FULL;

  // Union the lat/lon bboxes of every active filter into one rectangle.
  let minLat = 90;
  let minLon = 180;
  let maxLat = -90;
  let maxLon = -180;
  let any = false;

  if (filteredContinents) {
    for (const c of filteredContinents) {
      const b = CONTINENT_BOUNDS[c];
      minLat = Math.min(minLat, b[0]);
      minLon = Math.min(minLon, b[1]);
      maxLat = Math.max(maxLat, b[2]);
      maxLon = Math.max(maxLon, b[3]);
      any = true;
    }
  }
  if (filteredCountries) {
    for (const cc of filteredCountries) {
      const b = COUNTRY_BOUNDS[cc];
      if (!b) continue;
      minLat = Math.min(minLat, b[0]);
      minLon = Math.min(minLon, b[1]);
      maxLat = Math.max(maxLat, b[2]);
      maxLon = Math.max(maxLon, b[3]);
      any = true;
    }
  }
  if (!any) return FULL;

  // Sample corners and midpoints through the projection. Sampling more than
  // just the four corners helps when the projection curves a great-circle box
  // (e.g. a wide Russia/Asia bbox) so the viewBox still encloses the full
  // visible region.
  const sampleLats = [minLat, (minLat + maxLat) / 2, maxLat];
  const sampleLons = [minLon, (minLon + maxLon) / 2, maxLon];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const lat of sampleLats) {
    for (const lon of sampleLons) {
      const p = PROJECTION([lon, lat]);
      if (!p) continue;
      minX = Math.min(minX, p[0]);
      minY = Math.min(minY, p[1]);
      maxX = Math.max(maxX, p[0]);
      maxY = Math.max(maxY, p[1]);
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return FULL;

  // Padding so pins aren't flush against the edge of the visible region.
  const padding = 40;
  const x = minX - padding;
  const y = minY - padding;
  const w = maxX - minX + padding * 2;
  const h = maxY - minY + padding * 2;
  return `${x} ${y} ${w} ${h}`;
}
