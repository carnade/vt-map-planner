import type { PositionsResponse, Vehicle } from "../types/vehicle";

export interface Bbox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export const ALL_TRANSPORT_MODES = ["tram", "bus", "ferry", "train", "taxi"];

export async function fetchPositions(
  bbox: Bbox,
  modes: string[],
  lines?: string[],
  signal?: AbortSignal,
): Promise<Vehicle[]> {
  const params = new URLSearchParams({
    min_lat: bbox.minLat.toFixed(5),
    min_lon: bbox.minLon.toFixed(5),
    max_lat: bbox.maxLat.toFixed(5),
    max_lon: bbox.maxLon.toFixed(5),
  });
  if (modes.length < ALL_TRANSPORT_MODES.length) {
    params.set("modes", modes.join(","));
  }
  if (lines && lines.length > 0) {
    params.set("lines", lines.join(","));
  }
  const response = await fetch(`/api/positions?${params}`, { signal });
  if (!response.ok) {
    throw new Error(`positions request failed: ${response.status}`);
  }
  const body: PositionsResponse = await response.json();
  return body.vehicles;
}

// Covers the whole Västtrafik core region for reference lookups
const REGION_BBOX = { minLat: 57.3, minLon: 11.3, maxLat: 58.4, maxLon: 13.2 };

/** Find one specific vehicle anywhere in the region by its journey reference */
export async function locateVehicle(ref: string): Promise<Vehicle | null> {
  const params = new URLSearchParams({
    min_lat: String(REGION_BBOX.minLat),
    min_lon: String(REGION_BBOX.minLon),
    max_lat: String(REGION_BBOX.maxLat),
    max_lon: String(REGION_BBOX.maxLon),
    refs: ref,
  });
  const response = await fetch(`/api/positions?${params}`);
  if (!response.ok) {
    throw new Error(`locate request failed: ${response.status}`);
  }
  const body: PositionsResponse = await response.json();
  return body.vehicles[0] ?? null;
}
