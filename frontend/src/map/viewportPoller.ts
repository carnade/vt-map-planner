import type maplibregl from "maplibre-gl";
import { fetchPositions, type Bbox } from "../api/positions";
import { BUS_MIN_ZOOM, POLL_INTERVAL_MS } from "../config";
import { updateVehicles } from "./vehicleLayer";

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

export function startPolling(map: maplibregl.Map): () => void {
  let inFlight: AbortController | null = null;
  let requestCounter = 0;

  async function refresh(): Promise<void> {
    // Skip while backgrounded; resume on next tick when visible again
    if (document.hidden) return;
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    const requestId = ++requestCounter;
    try {
      const vehicles = await fetchPositions(
        currentBbox(map),
        map.getZoom() >= BUS_MIN_ZOOM,
        controller.signal,
      );
      // Ignore stale responses that finished after a newer request
      if (requestId === requestCounter) {
        updateVehicles(map, vehicles);
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
  void refresh();

  return () => {
    clearInterval(interval);
    map.off("moveend", onMoveEnd);
    inFlight?.abort();
  };
}
