import maplibregl from "maplibre-gl";
import { INITIAL_CENTER, INITIAL_ZOOM, MAP_STYLE_URL } from "../config";

export function createMap(container: HTMLElement): maplibregl.Map {
  const map = new maplibregl.Map({
    container,
    style: MAP_STYLE_URL,
    center: INITIAL_CENTER,
    zoom: INITIAL_ZOOM,
    attributionControl: {
      compact: true,
      customAttribution: "Data: Västtrafik",
    },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
    }),
  );
  map.touchZoomRotate.disableRotation();
  return map;
}
