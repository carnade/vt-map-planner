import maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import type { RouteResponse } from "../types/journey";
import { TRAIL_LAYER_ID } from "./vehicleLayer";

export const ROUTE_SOURCE_ID = "route";
export const ROUTE_CASING_LAYER_ID = "route-casing";
export const ROUTE_LAYER_ID = "route-line";

const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export function addRouteLayers(map: maplibregl.Map): void {
  map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: EMPTY });
  // Dark casing keeps light-colored lines (e.g. tram 1's white) visible
  map.addLayer(
    {
      id: ROUTE_CASING_LAYER_ID,
      type: "line",
      source: ROUTE_SOURCE_ID,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#111318",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 6, 16, 12],
        "line-opacity": 0.9,
      },
    },
    TRAIL_LAYER_ID,
  );
  map.addLayer(
    {
      id: ROUTE_LAYER_ID,
      type: "line",
      source: ROUTE_SOURCE_ID,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["coalesce", ["get", "bg_color"], "#4a90d9"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 3.5, 16, 7],
      },
    },
    TRAIL_LAYER_ID,
  );
}

export function drawRoute(map: maplibregl.Map, route: RouteResponse): void {
  const source = map.getSource<GeoJSONSource>(ROUTE_SOURCE_ID);
  if (!source) return;
  source.setData({
    type: "FeatureCollection",
    features: route.legs.map((leg) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: leg.coords },
      properties: { bg_color: leg.bg_color, line: leg.line },
    })),
  });

  const bounds = new maplibregl.LngLatBounds();
  for (const leg of route.legs) {
    for (const coord of leg.coords) bounds.extend(coord);
  }
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { padding: 80, maxZoom: 15 });
  }
}

export function clearRoute(map: maplibregl.Map): void {
  map.getSource<GeoJSONSource>(ROUTE_SOURCE_ID)?.setData(EMPTY);
}
