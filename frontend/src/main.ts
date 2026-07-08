import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { createMap } from "./map/createMap";
import { attachVehicleClickHandler } from "./map/popup";
import { addVehicleLayers } from "./map/vehicleLayer";
import { startPolling } from "./map/viewportPoller";

const container = document.getElementById("map");
if (!container) {
  throw new Error("#map container missing");
}

const map = createMap(container);

map.on("load", () => {
  addVehicleLayers(map);
  attachVehicleClickHandler(map);
  const stopPolling = startPolling(map);
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      stopPolling();
      map.remove();
    });
  }
});
