import type { PositionsResponse, Vehicle } from "../types/vehicle";

export interface Bbox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export async function fetchPositions(
  bbox: Bbox,
  includeBuses: boolean,
  signal?: AbortSignal,
): Promise<Vehicle[]> {
  const params = new URLSearchParams({
    min_lat: bbox.minLat.toFixed(5),
    min_lon: bbox.minLon.toFixed(5),
    max_lat: bbox.maxLat.toFixed(5),
    max_lon: bbox.maxLon.toFixed(5),
  });
  if (!includeBuses) {
    params.set("modes", "tram,train,ferry");
  }
  const response = await fetch(`/api/positions?${params}`, { signal });
  if (!response.ok) {
    throw new Error(`positions request failed: ${response.status}`);
  }
  const body: PositionsResponse = await response.json();
  return body.vehicles;
}
