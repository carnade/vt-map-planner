import type { DeparturesResponse, Stop } from "../types/stop";

export async function fetchStops(signal?: AbortSignal): Promise<Stop[]> {
  const response = await fetch("/api/stops", { signal });
  if (!response.ok) {
    throw new Error(`stops request failed: ${response.status}`);
  }
  const body = await response.json();
  return body.stops;
}

export async function fetchDepartures(
  gid: string,
  signal?: AbortSignal,
): Promise<DeparturesResponse> {
  const response = await fetch(`/api/stops/${encodeURIComponent(gid)}/departures`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`departures request failed: ${response.status}`);
  }
  return response.json();
}
