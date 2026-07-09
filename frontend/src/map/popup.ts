import maplibregl from "maplibre-gl";
import { escapeHtml, MODE_LABELS } from "../ui/html";
import { STOP_LAYER_ID } from "./stopLayer";
import { VEHICLE_LAYER_ID } from "./vehicleLayer";

// Extra pixels around a tap so vehicles/stops are easy to hit with a finger
const TAP_TOLERANCE_PX = 12;

export interface StopClick {
  gid: string;
  name: string;
}

interface VehiclePopupProps {
  line?: unknown;
  mode?: unknown;
  destination?: unknown;
  bg_color?: unknown;
  fg_color?: unknown;
}

function renderPopup(props: VehiclePopupProps): string {
  const line = escapeHtml(String(props.line ?? "?"));
  const mode = MODE_LABELS[String(props.mode)] ?? escapeHtml(String(props.mode));
  const destination = props.destination
    ? escapeHtml(String(props.destination))
    : null;
  const bg = typeof props.bg_color === "string" ? props.bg_color : "#4a90d9";
  const fg = typeof props.fg_color === "string" ? props.fg_color : "#ffffff";
  return `
    <div class="vehicle-popup">
      <div class="vehicle-popup-header">
        <span class="vehicle-line-badge" style="background:${bg};color:${fg}">${line}</span>
        <span class="vehicle-mode">${mode}</span>
      </div>
      ${destination ? `<div class="vehicle-destination">mot ${destination}</div>` : ""}
      <div class="vehicle-caveat">Positionen är uppskattad</div>
    </div>`;
}

export function showVehiclePopup(
  map: maplibregl.Map,
  props: VehiclePopupProps,
  lngLat: [number, number],
): maplibregl.Popup {
  return new maplibregl.Popup({
    closeButton: false,
    offset: 14,
    maxWidth: "260px",
  })
    .setLngLat(lngLat)
    .setHTML(renderPopup(props))
    .addTo(map);
}

export function attachMapClickHandlers(
  map: maplibregl.Map,
  onStopClick: (stop: StopClick) => void,
): void {
  let popup: maplibregl.Popup | null = null;

  map.on("click", (e) => {
    const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
      [e.point.x - TAP_TOLERANCE_PX, e.point.y - TAP_TOLERANCE_PX],
      [e.point.x + TAP_TOLERANCE_PX, e.point.y + TAP_TOLERANCE_PX],
    ];
    popup?.remove();
    popup = null;

    // Vehicles render on top of stops, so they win ties
    const vehicles = map.queryRenderedFeatures(bbox, {
      layers: [VEHICLE_LAYER_ID],
    });
    const vehicle = vehicles[0];
    if (vehicle && vehicle.geometry.type === "Point") {
      const [lon, lat] = vehicle.geometry.coordinates;
      popup = showVehiclePopup(map, vehicle.properties, [lon, lat]);
      return;
    }

    const stops = map.queryRenderedFeatures(bbox, { layers: [STOP_LAYER_ID] });
    const stop = stops[0];
    if (stop) {
      const { gid, name } = stop.properties as { gid: string; name: string };
      onStopClick({ gid, name });
    }
  });

  for (const layer of [VEHICLE_LAYER_ID, STOP_LAYER_ID]) {
    map.on("mouseenter", layer, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layer, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}
