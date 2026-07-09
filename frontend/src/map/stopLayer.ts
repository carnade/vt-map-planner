import type maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import { fetchStops } from "../api/stops";
import { STOP_MIN_ZOOM } from "../config";
import type { Stop } from "../types/stop";
import { VEHICLE_LAYER_ID } from "./vehicleLayer";

export const STOP_SOURCE_ID = "stops";
export const STOP_LAYER_ID = "stops-layer";

let loadedStops: Stop[] = [];

export function getStopByGid(gid: string): Stop | null {
  return loadedStops.find((s) => s.gid === gid) ?? null;
}

/** Case-insensitive stop name search; prefix matches rank first */
export function searchStops(query: string, limit = 8): Stop[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const prefix: Stop[] = [];
  const contains: Stop[] = [];
  for (const stop of loadedStops) {
    const name = stop.name.toLowerCase();
    if (name.startsWith(q)) {
      prefix.push(stop);
    } else if (name.includes(q)) {
      contains.push(stop);
    }
    if (prefix.length >= limit) break;
  }
  return [...prefix, ...contains].slice(0, limit);
}

/** Nearest loaded stop to a point, or null if none within maxMeters */
export function nearestStop(
  lat: number,
  lon: number,
  maxMeters = 400,
): Stop | null {
  let best: Stop | null = null;
  let bestDist = Infinity;
  // Approximate meters-per-degree at Gothenburg's latitude
  const latScale = 111_320;
  const lonScale = 111_320 * Math.cos((lat * Math.PI) / 180);
  for (const stop of loadedStops) {
    const dLat = (stop.lat - lat) * latScale;
    const dLon = (stop.lon - lon) * lonScale;
    const dist = dLat * dLat + dLon * dLon;
    if (dist < bestDist) {
      best = stop;
      bestDist = dist;
    }
  }
  return best !== null && Math.sqrt(bestDist) <= maxMeters ? best : null;
}

export function addStopLayers(map: maplibregl.Map): void {
  map.addSource(STOP_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer(
    {
      id: STOP_LAYER_ID,
      type: "circle",
      source: STOP_SOURCE_ID,
      minzoom: STOP_MIN_ZOOM,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 4, 17, 7.5],
        "circle-color": "#8a919c",
        "circle-opacity": 0.8,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#111318",
      },
    },
    // Render beneath vehicles so live dots stay visually on top
    VEHICLE_LAYER_ID,
  );
}

export async function loadStops(map: maplibregl.Map): Promise<void> {
  try {
    const stops = await fetchStops();
    loadedStops = stops;
    const source = map.getSource<GeoJSONSource>(STOP_SOURCE_ID);
    if (!source) return;
    source.setData({
      type: "FeatureCollection",
      features: stops.map((s) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.lon, s.lat] },
        properties: { gid: s.gid, name: s.name },
      })),
    });
  } catch (err) {
    console.warn("failed to load stops:", err);
  }
}
