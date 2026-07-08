import type maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import { fetchStops } from "../api/stops";
import { STOP_MIN_ZOOM } from "../config";
import { VEHICLE_LAYER_ID } from "./vehicleLayer";

export const STOP_SOURCE_ID = "stops";
export const STOP_LAYER_ID = "stops-layer";

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
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 2.5, 17, 5],
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
