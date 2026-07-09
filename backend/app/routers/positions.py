import asyncio
import time

from fastapi import APIRouter, HTTPException, Query, Request

from ..vasttrafik.schemas import PositionsResponse, shape_position

# Reject absurdly large bounding boxes (degrees); Gothenburg metro is ~0.5°
MAX_BBOX_SPAN_DEGREES = 2.0

router = APIRouter()

_cache: dict[tuple, tuple[float, PositionsResponse]] = {}
_cache_lock = asyncio.Lock()


def _cache_key(
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
    modes: str | None,
    lines: str | None,
) -> tuple:
    # Round so tiny viewport jitter between tabs still hits the same entry
    return (
        round(min_lat, 3),
        round(min_lon, 3),
        round(max_lat, 3),
        round(max_lon, 3),
        modes,
        lines,
    )


@router.get("/positions", response_model=PositionsResponse)
async def get_positions(
    request: Request,
    min_lat: float = Query(ge=-90, le=90),
    min_lon: float = Query(ge=-180, le=180),
    max_lat: float = Query(ge=-90, le=90),
    max_lon: float = Query(ge=-180, le=180),
    modes: str | None = Query(default=None, description="Comma-separated transport modes"),
    lines: str | None = Query(default=None, description="Comma-separated line designations"),
    refs: str | None = Query(default=None, description="Comma-separated journey detailsReferences"),
):
    if max_lat <= min_lat or max_lon <= min_lon:
        raise HTTPException(status_code=400, detail="Invalid bounding box")
    if max_lat - min_lat > MAX_BBOX_SPAN_DEGREES or max_lon - min_lon > MAX_BBOX_SPAN_DEGREES:
        raise HTTPException(status_code=400, detail="Bounding box too large")

    settings = request.app.state.settings
    key = _cache_key(min_lat, min_lon, max_lat, max_lon, modes, lines)
    now = time.monotonic()

    # Reference lookups are single-vehicle point queries — skip the cache
    if refs is None:
        cached = _cache.get(key)
        if cached and now - cached[0] < settings.positions_cache_ttl_seconds:
            return cached[1]

    mode_list = [m.strip() for m in modes.split(",")] if modes else None
    line_list = [l.strip() for l in lines.split(",")] if lines else None
    ref_list = [r.strip() for r in refs.split(",")] if refs else None
    raw = await request.app.state.vasttrafik.get_positions(
        min_lat, min_lon, max_lat, max_lon,
        transport_modes=mode_list,
        line_designations=line_list,
        details_references=ref_list,
    )
    vehicles = [v for v in (shape_position(item) for item in raw) if v is not None]
    result = PositionsResponse(vehicles=vehicles, fetched_at=time.time())

    if refs is not None:
        return result

    async with _cache_lock:
        _cache[key] = (now, result)
        # Drop stale entries so the cache doesn't grow unboundedly
        stale = [
            k
            for k, (ts, _) in _cache.items()
            if now - ts > settings.positions_cache_ttl_seconds * 10
        ]
        for k in stale:
            del _cache[k]

    return result
