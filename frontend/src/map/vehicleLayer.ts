import type maplibregl from "maplibre-gl";

export const VEHICLE_SOURCE_ID = "vehicles";
export const VEHICLE_LAYER_ID = "vehicles-layer";
export const VEHICLE_LABEL_LAYER_ID = "vehicles-labels";
export const TRAIL_SOURCE_ID = "vehicle-trails";
export const TRAIL_LAYER_ID = "vehicle-trails-layer";

const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const MODE_FALLBACK_COLOR = "#4a90d9";

export function addVehicleLayers(map: maplibregl.Map): void {
  map.addSource(VEHICLE_SOURCE_ID, { type: "geojson", data: EMPTY });
  map.addSource(TRAIL_SOURCE_ID, { type: "geojson", data: EMPTY });

  // Trails go in first so vehicles (and stops) render above them
  map.addLayer({
    id: TRAIL_LAYER_ID,
    type: "line",
    source: TRAIL_SOURCE_ID,
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": ["coalesce", ["get", "bg_color"], MODE_FALLBACK_COLOR],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0.15, 13, 0.35],
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1, 14, 2.5, 17, 4],
    },
  });

  map.addLayer({
    id: VEHICLE_LAYER_ID,
    type: "circle",
    source: VEHICLE_SOURCE_ID,
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10, 4,
        14, 8,
        17, 12,
      ],
      "circle-color": ["coalesce", ["get", "bg_color"], MODE_FALLBACK_COLOR],
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "rgba(255, 255, 255, 0.55)",
    },
  });

  map.addLayer({
    id: VEHICLE_LABEL_LAYER_ID,
    type: "symbol",
    source: VEHICLE_SOURCE_ID,
    minzoom: 12,
    layout: {
      "text-field": ["get", "line"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 12, 8, 17, 12],
      "text-allow-overlap": true,
      "text-font": ["Noto Sans Bold"],
    },
    paint: {
      "text-color": ["coalesce", ["get", "fg_color"], "#ffffff"],
    },
  });
}
