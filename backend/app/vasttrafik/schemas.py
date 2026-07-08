from pydantic import BaseModel


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
    return VehiclePosition(
        id=ref,
        line=line.get("designation") or line.get("name") or "?",
        mode=(line.get("transportMode") or "unknown").lower(),
        lat=lat,
        lon=lon,
        destination=raw.get("direction"),
        bg_color=line.get("backgroundColor"),
        fg_color=line.get("foregroundColor"),
    )
