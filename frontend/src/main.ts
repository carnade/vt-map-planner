import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { POLL_INTERVAL_MS } from "./config";
import { createMap } from "./map/createMap";
import { locateVehicle } from "./api/positions";
import { attachLongPressPicker } from "./map/longPress";
import { attachMapClickHandlers, showVehiclePopup } from "./map/popup";
import { addRouteLayers } from "./map/routeLayer";
import { addStopLayers, getStopByGid, loadStops } from "./map/stopLayer";
import { VehicleAnimator } from "./map/vehicleAnimator";
import { addVehicleLayers } from "./map/vehicleLayer";
import { startPolling } from "./map/viewportPoller";
import { removeCapWarning } from "./ui/capWarning";
import { createDeparturesView } from "./ui/departuresView";
import { createFilterView, createPeekModeBar } from "./ui/filterView";
import { Panel } from "./ui/panel";
import { createPlannerView } from "./ui/plannerView";

const container = document.getElementById("map");
if (!container) {
  throw new Error("#map container missing");
}

const map = createMap(container);

map.on("load", () => {
  addVehicleLayers(map);
  addStopLayers(map);
  addRouteLayers(map);
  void loadStops(map);

  const panel = new Panel();
  const plannerView = createPlannerView(map);
  const openPlanner = () => {
    if (panel.topView() !== plannerView) {
      panel.push(plannerView);
    }
    panel.open();
  };

  // Timetable row tap: find that exact vehicle and fly to it
  const onLocateVehicle = async (ref: string): Promise<boolean> => {
    try {
      const vehicle = await locateVehicle(ref);
      if (!vehicle) return false;
      panel.peek();
      map.flyTo({ center: [vehicle.lon, vehicle.lat], zoom: 15.5 });
      showVehiclePopup(map, vehicle, [vehicle.lon, vehicle.lat]);
      return true;
    } catch {
      return false;
    }
  };

  const openStop = (stop: { gid: string; name: string }) => {
    // Stack on top of the planner (so its route survives); swap out an
    // already-open departure board
    if (panel.topView() === plannerView) {
      panel.push(createDeparturesView(stop, onLocateVehicle));
    } else {
      panel.replaceTop(createDeparturesView(stop, onLocateVehicle));
    }
    panel.open();
  };

  panel.setRoot(
    createFilterView(openPlanner, (stop) => {
      openStop(stop);
      // Search/favorites picks also bring the stop into view
      const match = getStopByGid(stop.gid);
      if (match) {
        map.flyTo({ center: [match.lon, match.lat], zoom: 15 });
      }
    }),
  );
  panel.setPeekContent(createPeekModeBar());

  attachMapClickHandlers(map, openStop);
  attachLongPressPicker(map, openPlanner);

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
