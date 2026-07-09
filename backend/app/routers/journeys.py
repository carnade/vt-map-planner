import time

from fastapi import APIRouter, HTTPException, Query, Request

from ..vasttrafik.schemas import (
    JourneysResponse,
    LocationsResponse,
    RouteResponse,
    shape_journey,
    shape_location,
    shape_route,
)

router = APIRouter()

# Route geometry is immutable per reference; cache briefly to absorb re-clicks
_route_cache: dict[str, tuple[float, RouteResponse]] = {}
ROUTE_CACHE_TTL_SECONDS = 300.0
ROUTE_CACHE_MAX_ENTRIES = 50


@router.get("/locations", response_model=LocationsResponse)
async def search_locations(
    request: Request,
    q: str = Query(min_length=2, max_length=100),
):
    raw = await request.app.state.vasttrafik.get_locations_by_text(q)
    results = raw.get("results") or []
    locations = [
        loc for loc in (shape_location(item) for item in results) if loc is not None
    ]
    return LocationsResponse(locations=locations)


@router.get("/journeys", response_model=JourneysResponse)
async def search_journeys(
    request: Request,
    origin_gid: str = Query(pattern=r"^\d{4,20}$"),
    dest_gid: str = Query(pattern=r"^\d{4,20}$"),
):
    if origin_gid == dest_gid:
        raise HTTPException(status_code=400, detail="Origin and destination are the same")
    raw = await request.app.state.vasttrafik.get_journeys(origin_gid, dest_gid)
    results = raw.get("results") or []
    journeys = [
        j for j in (shape_journey(item) for item in results) if j is not None
    ]
    return JourneysResponse(journeys=journeys, fetched_at=time.time())


@router.get("/journeys/{details_reference}/route", response_model=RouteResponse)
async def get_route(request: Request, details_reference: str):
    now = time.monotonic()
    cached = _route_cache.get(details_reference)
    if cached and now - cached[0] < ROUTE_CACHE_TTL_SECONDS:
        return cached[1]

    try:
        raw = await request.app.state.vasttrafik.get_journey_details(details_reference)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Upstream details request failed") from exc

    result = shape_route(raw)
    if len(_route_cache) >= ROUTE_CACHE_MAX_ENTRIES:
        oldest = min(_route_cache, key=lambda k: _route_cache[k][0])
        del _route_cache[oldest]
    _route_cache[details_reference] = (now, result)
    return result
