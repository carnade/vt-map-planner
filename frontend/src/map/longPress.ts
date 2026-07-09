import maplibregl from "maplibre-gl";
import { pickDest, pickOrigin } from "../state/routeState";
import type { Stop } from "../types/stop";
import { escapeHtml } from "../ui/html";
import { nearestStop } from "./stopLayer";

const LONG_PRESS_MS = 600;
const MOVE_CANCEL_PX = 10;

/**
 * Long-press (or desktop right-click) picks the nearest stop as trip
 * origin/destination via a small chooser popup.
 */
export function attachLongPressPicker(
  map: maplibregl.Map,
  onPick: () => void,
): void {
  let timer: number | null = null;
  let startPoint: { x: number; y: number } | null = null;
  let popup: maplibregl.Popup | null = null;

  function showChooser(stop: Stop): void {
    popup?.remove();
    const container = document.createElement("div");
    container.className = "pick-chooser";
    container.innerHTML = `
      <div class="pick-chooser-name">${escapeHtml(stop.name)}</div>
      <div class="pick-chooser-buttons">
        <button class="pick-from">Härifrån</button>
        <button class="pick-to">Hit</button>
      </div>`;
    const location = { gid: stop.gid, name: stop.name, lat: stop.lat, lon: stop.lon };
    container.querySelector(".pick-from")!.addEventListener("click", () => {
      pickOrigin(location);
      popup?.remove();
      onPick();
    });
    container.querySelector(".pick-to")!.addEventListener("click", () => {
      pickDest(location);
      popup?.remove();
      onPick();
    });
    popup = new maplibregl.Popup({ closeButton: false, offset: 10 })
      .setLngLat([stop.lon, stop.lat])
      .setDOMContent(container)
      .addTo(map);
  }

  function pickAt(lngLat: maplibregl.LngLat): void {
    const stop = nearestStop(lngLat.lat, lngLat.lng);
    if (stop) showChooser(stop);
  }

  function cancel(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    startPoint = null;
  }

  map.on("touchstart", (e) => {
    if (e.originalEvent.touches.length !== 1) {
      cancel();
      return;
    }
    startPoint = { x: e.point.x, y: e.point.y };
    const lngLat = e.lngLat;
    timer = window.setTimeout(() => pickAt(lngLat), LONG_PRESS_MS);
  });
  map.on("touchmove", (e) => {
    if (!startPoint) return;
    const dx = e.point.x - startPoint.x;
    const dy = e.point.y - startPoint.y;
    if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) cancel();
  });
  map.on("touchend", cancel);
  map.on("touchcancel", cancel);

  // Desktop equivalent: right-click
  map.on("contextmenu", (e) => {
    e.preventDefault();
    pickAt(e.lngLat);
  });
}
