import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { createMap } from "./map/createMap";
import { attachVehicleClickHandler } from "./map/popup";
import { VehicleAnimator } from "./map/vehicleAnimator";
import { addVehicleLayers } from "./map/vehicleLayer";
import { startPolling } from "./map/viewportPoller";
import { POLL_INTERVAL_MS } from "./config";

const container = document.getElementById("map");
if (!container) {
  throw new Error("#map container missing");
}

const map = createMap(container);

map.on("load", () => {
  addVehicleLayers(map);
  attachVehicleClickHandler(map);
  const animator = new VehicleAnimator(map, POLL_INTERVAL_MS);
  const stopPolling = startPolling(map, animator);
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      stopPolling();
      map.remove();
    });
  }
});
