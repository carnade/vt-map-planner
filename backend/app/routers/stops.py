import asyncio
import time

from fastapi import APIRouter, Depends, HTTPException, Path

from ..config import get_settings
from ..deps import get_vasttrafik
from ..vasttrafik.client import VasttrafikClient
from ..vasttrafik.schemas import (
    DeparturesResponse,
    StopsResponse,
    shape_departure,
    shape_stop_area,
)

router = APIRouter()

_stops_cache: tuple[float, StopsResponse] | None = None
_stops_lock = asyncio.Lock()

_departures_cache: dict[str, tuple[float, DeparturesResponse]] = {}
_departures_lock = asyncio.Lock()


@router.get("/stops", response_model=StopsResponse)
async def get_stops(vasttrafik: VasttrafikClient = Depends(get_vasttrafik)):
    global _stops_cache
    settings = get_settings()
    now = time.monotonic()

    if _stops_cache and now - _stops_cache[0] < settings.stops_cache_ttl_seconds:
        return _stops_cache[1]

    async with _stops_lock:
        if _stops_cache and now - _stops_cache[0] < settings.stops_cache_ttl_seconds:
            return _stops_cache[1]
        try:
            raw = await vasttrafik.get_stop_areas()
        except Exception:
            # Stop data changes rarely: serve a stale copy over failing hard
            if _stops_cache:
                return _stops_cache[1]
            raise
        stops = [s for s in (shape_stop_area(item) for item in raw) if s is not None]
        result = StopsResponse(stops=stops, fetched_at=time.time())
        _stops_cache = (now, result)
        return result


@router.get("/stops/{gid}/departures", response_model=DeparturesResponse)
async def get_departures(
    gid: str = Path(pattern=r"^\d{4,20}$"),
    vasttrafik: VasttrafikClient = Depends(get_vasttrafik),
):
    settings = get_settings()
    now = time.monotonic()

    cached = _departures_cache.get(gid)
    if cached and now - cached[0] < settings.departures_cache_ttl_seconds:
        return cached[1]

    try:
        raw = await vasttrafik.get_departures(gid)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Upstream departures request failed") from exc

    results = raw.get("results") or []
    departures = [d for d in (shape_departure(item) for item in results) if d is not None]
    stop_name = None
    if results:
        stop_point = results[0].get("stopPoint") or {}
        stop_name = stop_point.get("name")
    result = DeparturesResponse(
        stop_name=stop_name, departures=departures, fetched_at=time.time()
    )

    async with _departures_lock:
        _departures_cache[gid] = (now, result)
        stale = [
            k
            for k, (ts, _) in _departures_cache.items()
            if now - ts > settings.departures_cache_ttl_seconds * 10
        ]
        for k in stale:
            del _departures_cache[k]

    return result
