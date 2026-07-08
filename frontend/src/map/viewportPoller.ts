import type maplibregl from "maplibre-gl";
import { fetchPositions, type Bbox } from "../api/positions";
import { BUS_MIN_ZOOM, POLL_INTERVAL_MS } from "../config";
import type { VehicleAnimator } from "./vehicleAnimator";

// Fetch slightly beyond the viewport so vehicles don't pop in at the edges
const BBOX_PADDING_FACTOR = 0.15;

function currentBbox(map: maplibregl.Map): Bbox {
  const bounds = map.getBounds();
  const latPad = (bounds.getNorth() - bounds.getSouth()) * BBOX_PADDING_FACTOR;
  const lonPad = (bounds.getEast() - bounds.getWest()) * BBOX_PADDING_FACTOR;
  return {
    minLat: Math.max(-90, bounds.getSouth() - latPad),
    minLon: Math.max(-180, bounds.getWest() - lonPad),
    maxLat: Math.min(90, bounds.getNorth() + latPad),
    maxLon: Math.min(180, bounds.getEast() + lonPad),
  };
}

export function startPolling(
  map: maplibregl.Map,
  animator: VehicleAnimator,
): () => void {
  let inFlight: AbortController | null = null;
  let requestCounter = 0;
  let busesShown = false;

  async function refresh(): Promise<void> {
    // Skip while backgrounded; resume on next tick when visible again
    if (document.hidden) return;
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    const requestId = ++requestCounter;
    const includeBuses = map.getZoom() >= BUS_MIN_ZOOM;
    try {
      const vehicles = await fetchPositions(
        currentBbox(map),
        includeBuses,
        controller.signal,
      );
      // Ignore stale responses that finished after a newer request
      if (requestId === requestCounter) {
        if (busesShown && !includeBuses) animator.removeMode("bus");
        busesShown = includeBuses;
        animator.ingest(vehicles);
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        console.warn("positions poll failed:", err);
      }
    }
  }

  const onMoveEnd = () => void refresh();
  map.on("moveend", onMoveEnd);
  const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);

  const onVisibility = () => {
    if (document.hidden) {
      animator.stop();
    } else {
      animator.start();
      void refresh();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  animator.start();
  void refresh();

  return () => {
    clearInterval(interval);
    map.off("moveend", onMoveEnd);
    document.removeEventListener("visibilitychange", onVisibility);
    animator.stop();
    inFlight?.abort();
  };
}
