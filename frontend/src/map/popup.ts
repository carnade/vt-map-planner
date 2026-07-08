import maplibregl from "maplibre-gl";
import type { MapGeoJSONFeature } from "maplibre-gl";
import { VEHICLE_LAYER_ID } from "./vehicleLayer";

const MODE_LABELS: Record<string, string> = {
  tram: "Spårvagn",
  bus: "Buss",
  train: "Tåg",
  ferry: "Färja",
  taxi: "Taxi",
};

// Extra pixels around a tap so vehicles are easy to hit with a finger
const TAP_TOLERANCE_PX = 12;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function renderPopup(feature: MapGeoJSONFeature): string {
  const props = feature.properties;
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

export function attachVehicleClickHandler(map: maplibregl.Map): void {
  let popup: maplibregl.Popup | null = null;

  map.on("click", (e) => {
    const features = map.queryRenderedFeatures(
      [
        [e.point.x - TAP_TOLERANCE_PX, e.point.y - TAP_TOLERANCE_PX],
        [e.point.x + TAP_TOLERANCE_PX, e.point.y + TAP_TOLERANCE_PX],
      ],
      { layers: [VEHICLE_LAYER_ID] },
    );
    popup?.remove();
    popup = null;
    const feature = features[0];
    if (!feature || feature.geometry.type !== "Point") return;
    const [lon, lat] = feature.geometry.coordinates;
    popup = new maplibregl.Popup({
      closeButton: false,
      offset: 14,
      maxWidth: "260px",
    })
      .setLngLat([lon, lat])
      .setHTML(renderPopup(feature))
      .addTo(map);
  });

  map.on("mouseenter", VEHICLE_LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", VEHICLE_LAYER_ID, () => {
    map.getCanvas().style.cursor = "";
  });
}
