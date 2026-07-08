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
  const response = await fetch(`/api/positions?${params}`, { signal });
  if (!response.ok) {
    throw new Error(`positions request failed: ${response.status}`);
  }
  const body: PositionsResponse = await response.json();
  return body.vehicles;
}
