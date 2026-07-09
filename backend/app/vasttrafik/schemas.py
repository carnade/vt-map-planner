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
    # Same reference the positions endpoint uses — links a departure row to
    # its live vehicle on the map
    details_reference: str | None = None


class DeparturesResponse(BaseModel):
    stop_name: str | None = None
    departures: list[Departure]
    fetched_at: float


class LocationHit(BaseModel):
    gid: str
    name: str
    lat: float
    lon: float


class LocationsResponse(BaseModel):
    locations: list[LocationHit]


class JourneyStop(BaseModel):
    name: str
    platform: str | None = None
    planned_time: str
    estimated_time: str | None = None
    lat: float | None = None
    lon: float | None = None


class JourneyLeg(BaseModel):
    line: str
    mode: str
    direction: str | None = None
    origin: JourneyStop
    destination: JourneyStop
    is_cancelled: bool = False
    is_part_cancelled: bool = False
    bg_color: str | None = None
    fg_color: str | None = None


class Journey(BaseModel):
    details_reference: str
    legs: list[JourneyLeg]
    is_departed: bool = False


class JourneysResponse(BaseModel):
    journeys: list[Journey]
    fetched_at: float


class RouteLeg(BaseModel):
    line: str
    mode: str
    bg_color: str | None = None
    fg_color: str | None = None
    coords: list[list[float]]  # [lon, lat] pairs, ready for GeoJSON


class RouteResponse(BaseModel):
    legs: list[RouteLeg]
    line_designations: list[str]


def shape_location(raw: dict) -> LocationHit | None:
    gid = raw.get("gid")
    name = raw.get("name")
    lat = raw.get("latitude")
    lon = raw.get("longitude")
    if not gid or not name or lat is None or lon is None:
        return None
    return LocationHit(gid=gid, name=name, lat=lat, lon=lon)


def _shape_journey_stop(raw: dict) -> JourneyStop | None:
    stop_point = raw.get("stopPoint") or {}
    planned = raw.get("plannedTime")
    name = stop_point.get("name")
    if not name or planned is None:
        return None
    return JourneyStop(
        name=name,
        platform=stop_point.get("platform"),
        planned_time=planned,
        estimated_time=raw.get("estimatedTime"),
        lat=stop_point.get("latitude"),
        lon=stop_point.get("longitude"),
    )


def shape_journey(raw: dict) -> Journey | None:
    ref = raw.get("detailsReference")
    if not ref:
        return None
    legs = []
    for leg in raw.get("tripLegs") or []:
        journey = leg.get("serviceJourney") or {}
        line = journey.get("line") or {}
        origin = _shape_journey_stop(leg.get("origin") or {})
        destination = _shape_journey_stop(leg.get("destination") or {})
        if origin is None or destination is None:
            continue
        legs.append(
            JourneyLeg(
                line=line.get("designation") or line.get("shortName") or "?",
                mode=(line.get("transportMode") or "unknown").lower(),
                direction=(journey.get("directionDetails") or {}).get("shortDirection"),
                origin=origin,
                destination=destination,
                is_cancelled=bool(leg.get("isCancelled")),
                is_part_cancelled=bool(leg.get("isPartCancelled")),
                bg_color=line.get("backgroundColor"),
                fg_color=line.get("foregroundColor"),
            )
        )
    if not legs:
        return None
    return Journey(
        details_reference=ref, legs=legs, is_departed=bool(raw.get("isDeparted"))
    )


def _nearest_index(coords: list[dict], lat: float, lon: float) -> int:
    best, best_dist = 0, float("inf")
    for i, c in enumerate(coords):
        d = (c["latitude"] - lat) ** 2 + (c["longitude"] - lon) ** 2
        if d < best_dist:
            best, best_dist = i, d
    return best


def shape_route(raw: dict) -> RouteResponse:
    """Clip each leg's full service-journey polyline to the traveled segment."""
    legs: list[RouteLeg] = []
    designations: list[str] = []
    for leg in raw.get("tripLegs") or []:
        calls = leg.get("callsOnTripLeg") or []
        for journey in leg.get("serviceJourneys") or []:
            line = journey.get("line") or {}
            coords = journey.get("serviceJourneyCoordinates") or []
            if len(coords) < 2:
                continue
            clipped = coords
            if calls:
                first, last = calls[0], calls[-1]
                if first.get("latitude") is not None and last.get("latitude") is not None:
                    i = _nearest_index(coords, first["latitude"], first["longitude"])
                    j = _nearest_index(coords, last["latitude"], last["longitude"])
                    if i > j:
                        i, j = j, i
                    if j - i >= 1:
                        clipped = coords[i : j + 1]
            # The details endpoint names lines like positions does: line.name
            designation = (
                line.get("name") or line.get("designation") or line.get("shortName") or "?"
            )
            if designation not in designations:
                designations.append(designation)
            legs.append(
                RouteLeg(
                    line=designation,
                    mode=(line.get("transportMode") or "unknown").lower(),
                    bg_color=line.get("backgroundColor"),
                    fg_color=line.get("foregroundColor"),
                    coords=[[c["longitude"], c["latitude"]] for c in clipped],
                )
            )
    return RouteResponse(legs=legs, line_designations=designations)


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
        details_reference=raw.get("detailsReference"),
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
