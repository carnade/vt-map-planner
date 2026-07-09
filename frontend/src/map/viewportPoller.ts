import type maplibregl from "maplibre-gl";
import {
  ALL_TRANSPORT_MODES,
  fetchPositions,
  type Bbox,
} from "../api/positions";
import { BUS_MIN_ZOOM, POLL_INTERVAL_MS, VEHICLE_CAP } from "../config";
import {
  getEnabledModes,
  isHideBusesOnZoomOut,
  recordSeen,
  subscribeFilters,
  vehiclePassesFilter,
} from "../state/filterState";
import {
  getActiveLines,
  isFocusActive,
  subscribeRoute,
  vehicleOnRoute,
} from "../state/routeState";
import { setCapWarningVisible } from "../ui/capWarning";
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
    // Focus mode: an active planned route overrides the mode/line filters —
    // show exactly the route's lines, nothing else
    const focus = isFocusActive();
    const includeBuses =
      !isHideBusesOnZoomOut() || map.getZoom() >= BUS_MIN_ZOOM;
    const modes = focus
      ? [...ALL_TRANSPORT_MODES]
      : getEnabledModes().filter((m) => m !== "bus" || includeBuses);
    if (modes.length === 0) {
      animator.removeWhere(() => true);
      setCapWarningVisible(false);
      return;
    }
    try {
      const vehicles = await fetchPositions(
        currentBbox(map),
        modes,
        focus ? getActiveLines() : undefined,
        controller.signal,
      );
      // Ignore stale responses that finished after a newer request
      if (requestId === requestCounter) {
        if (busesShown && !includeBuses && !focus) {
          animator.removeWhere((v) => v.mode === "bus");
        }
        busesShown = includeBuses;
        // Record every line we've seen (even filtered ones, so the filter
        // panel can list them), but only animate the ones passing the filter
        recordSeen(vehicles);
        animator.ingest(
          vehicles.filter(focus ? vehicleOnRoute : vehiclePassesFilter),
        );
        // At the API's response cap some vehicles in view are missing
        setCapWarningVisible(vehicles.length >= VEHICLE_CAP);
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

  // Filter changes take effect immediately: purge newly hidden vehicles
  // and refetch (mode set may have grown)
  const unsubscribeFilters = subscribeFilters(() => {
    if (!isFocusActive()) {
      animator.removeWhere((v) => !vehiclePassesFilter(v));
    }
    void refresh();
  });

  // Route focus entering/leaving swaps the whole visible vehicle set
  const unsubscribeRoute = subscribeRoute(() => {
    animator.removeWhere((v) =>
      isFocusActive() ? !vehicleOnRoute(v) : !vehiclePassesFilter(v),
    );
    void refresh();
  });

  animator.start();
  void refresh();

  return () => {
    clearInterval(interval);
    map.off("moveend", onMoveEnd);
    document.removeEventListener("visibilitychange", onVisibility);
    unsubscribeFilters();
    unsubscribeRoute();
    animator.stop();
    inFlight?.abort();
  };
}
