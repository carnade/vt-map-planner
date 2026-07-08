// OpenFreeMap hosted styles are keyless with no rate limits. "dark" is
// near-black; "fiord" is a blue-gray alternative. See FUTURE_IMPROVEMENTS.md
// for the MapTiler alternative if these prove insufficient.
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

export const INITIAL_CENTER: [number, number] = [11.9746, 57.7089]; // Gothenburg
export const INITIAL_ZOOM = 13;

export const POLL_INTERVAL_MS = 2000;

// Buses are only fetched/shown at or above this zoom (mirrors sl-map's
// approach: trams/trains/ferries always visible, buses when zoomed in)
export const BUS_MIN_ZOOM = 13;
