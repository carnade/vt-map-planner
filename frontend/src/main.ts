import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { POLL_INTERVAL_MS } from "./config";
import { createMap } from "./map/createMap";
import { attachMapClickHandlers } from "./map/popup";
import { addStopLayers, loadStops } from "./map/stopLayer";
import { VehicleAnimator } from "./map/vehicleAnimator";
import { addVehicleLayers } from "./map/vehicleLayer";
import { startPolling } from "./map/viewportPoller";
import { removeCapWarning } from "./ui/capWarning";
import { createDeparturesView } from "./ui/departuresView";
import { createFilterView, createPeekModeBar } from "./ui/filterView";
import { Panel } from "./ui/panel";

const container = document.getElementById("map");
if (!container) {
  throw new Error("#map container missing");
}

const map = createMap(container);

map.on("load", () => {
  addVehicleLayers(map);
  addStopLayers(map);
  void loadStops(map);

  const panel = new Panel();
  panel.setRoot(createFilterView());
  panel.setPeekContent(createPeekModeBar());

  attachMapClickHandlers(map, (stop) => {
    panel.replaceTop(createDeparturesView(stop));
    panel.open();
  });

  const animator = new VehicleAnimator(map, POLL_INTERVAL_MS);
  const stopPolling = startPolling(map, animator);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      stopPolling();
      panel.destroy();
      removeCapWarning();
      map.remove();
    });
  }
});
