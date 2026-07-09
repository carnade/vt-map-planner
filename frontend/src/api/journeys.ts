import type { Journey, LocationHit, RouteResponse } from "../types/journey";

export async function searchLocations(
  query: string,
  signal?: AbortSignal,
): Promise<LocationHit[]> {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`/api/locations?${params}`, { signal });
  if (!response.ok) {
    throw new Error(`locations request failed: ${response.status}`);
  }
  const body = await response.json();
  return body.locations;
}

export async function searchJourneys(
  originGid: string,
  destGid: string,
  signal?: AbortSignal,
): Promise<Journey[]> {
  const params = new URLSearchParams({ origin_gid: originGid, dest_gid: destGid });
  const response = await fetch(`/api/journeys?${params}`, { signal });
  if (!response.ok) {
    throw new Error(`journeys request failed: ${response.status}`);
  }
  const body = await response.json();
  return body.journeys;
}

export async function fetchRoute(
  detailsReference: string,
  signal?: AbortSignal,
): Promise<RouteResponse> {
  const response = await fetch(
    `/api/journeys/${encodeURIComponent(detailsReference)}/route`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(`route request failed: ${response.status}`);
  }
  return response.json();
}
