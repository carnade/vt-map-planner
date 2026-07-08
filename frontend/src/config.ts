// OpenFreeMap hosted styles are keyless with no rate limits. "dark" is
// near-black; "fiord" is a blue-gray alternative. See FUTURE_IMPROVEMENTS.md
// for the MapTiler alternative if these prove insufficient.
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

export const INITIAL_CENTER: [number, number] = [11.9746, 57.7089]; // Gothenburg
export const INITIAL_ZOOM = 13;

// Dead-reckoning animation glides vehicles between reports, so polling can
// be sparser than the visual update rate
export const POLL_INTERVAL_MS = 6000;

// When the "hide buses on zoom out" filter switch is on, buses are only
// fetched/shown at or above this zoom (mirrors sl-map's approach)
export const BUS_MIN_ZOOM = 13;

// Västtrafik's /positions endpoint returns at most this many vehicles per
// request; hitting it means some vehicles in view are silently missing
export const VEHICLE_CAP = 200;

// Stops fade in at this zoom
export const STOP_MIN_ZOOM = 14;

export const DEPARTURES_REFRESH_MS = 30_000;

// At or above this width the panel is a sidebar; below, a bottom sheet
export const PANEL_BREAKPOINT_PX = 768;
