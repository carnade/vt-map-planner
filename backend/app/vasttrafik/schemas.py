import re

from pydantic import BaseModel

# Västtrafik appends boarding notes to the direction, e.g.
# "Arendal, Påstigning fram" — strip them from the destination label
_BOARDING_NOTE = re.compile(r",\s*Påstigning.*$", re.IGNORECASE)


class VehiclePosition(BaseModel):
    id: str
    line: str
    mode: str
    lat: float
    lon: float
    destination: str | None = None
    bg_color: str | None = None
    fg_color: str | None = None


class PositionsResponse(BaseModel):
    vehicles: list[VehiclePosition]
    fetched_at: float


class StopArea(BaseModel):
    gid: str
    name: str
    lat: float
    lon: float


class StopsResponse(BaseModel):
    stops: list[StopArea]
    fetched_at: float


class Departure(BaseModel):
    line: str
    mode: str
    destination: str | None = None
    planned_time: str
    estimated_time: str | None = None
    is_cancelled: bool = False
    is_part_cancelled: bool = False
    platform: str | None = None
    bg_color: str | None = None
    fg_color: str | None = None


class DeparturesResponse(BaseModel):
    stop_name: str | None = None
    departures: list[Departure]
    fetched_at: float


def shape_stop_area(raw: dict) -> StopArea | None:
    gid = raw.get("gid")
    name = raw.get("name")
    lat = raw.get("lat")
    lon = raw.get("long")
    if not gid or not name or lat is None or lon is None:
        return None
    return StopArea(gid=gid, name=name, lat=lat, lon=lon)


def shape_departure(raw: dict) -> Departure | None:
    journey = raw.get("serviceJourney") or {}
    line = journey.get("line") or {}
    planned = raw.get("plannedTime")
    if planned is None:
        return None
    destination = (journey.get("directionDetails") or {}).get("shortDirection")
    if not destination:
        direction = journey.get("direction")
        destination = _BOARDING_NOTE.sub("", direction).strip() if direction else None
    return Departure(
        line=line.get("designation") or line.get("shortName") or line.get("name") or "?",
        mode=(line.get("transportMode") or "unknown").lower(),
        destination=destination,
        planned_time=planned,
        estimated_time=raw.get("estimatedTime"),
        is_cancelled=bool(raw.get("isCancelled")),
        is_part_cancelled=bool(raw.get("isPartCancelled")),
        platform=(raw.get("stopPoint") or {}).get("platform"),
        bg_color=line.get("backgroundColor"),
        fg_color=line.get("foregroundColor"),
    )


def shape_position(raw: dict) -> VehiclePosition | None:
    """Map a raw Västtrafik /positions entry to our trimmed shape.

    Returns None for entries missing the fields the map cannot do without.
    """
    line = raw.get("line") or {}
    lat = raw.get("latitude")
    lon = raw.get("longitude")
    ref = raw.get("detailsReference")
    if lat is None or lon is None or ref is None:
        return None
    direction = raw.get("direction")
    if direction:
        direction = _BOARDING_NOTE.sub("", direction).strip()
    return VehiclePosition(
        id=ref,
        line=line.get("name") or "?",
        mode=(line.get("transportMode") or "unknown").lower(),
        lat=lat,
        lon=lon,
        destination=direction,
        bg_color=line.get("backgroundColor"),
        fg_color=line.get("foregroundColor"),
    )
