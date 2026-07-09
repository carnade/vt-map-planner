import httpx

from .auth import TokenManager

# Västtrafik caps this endpoint at 200 results per request
POSITIONS_LIMIT = 200


class VasttrafikClient:
    def __init__(
        self, http: httpx.AsyncClient, token_manager: TokenManager, base_url: str
    ) -> None:
        self._http = http
        self._tokens = token_manager
        self._base_url = base_url.rstrip("/")

    async def get_positions(
        self,
        min_lat: float,
        min_lon: float,
        max_lat: float,
        max_lon: float,
        transport_modes: list[str] | None = None,
        line_designations: list[str] | None = None,
        details_references: list[str] | None = None,
    ) -> list[dict]:
        params: dict = {
            "lowerLeftLat": min_lat,
            "lowerLeftLong": min_lon,
            "upperRightLat": max_lat,
            "upperRightLong": max_lon,
            "limit": POSITIONS_LIMIT,
        }
        if transport_modes:
            params["transportModes"] = transport_modes
        if line_designations:
            params["lineDesignations"] = line_designations
        if details_references:
            params["detailsReferences"] = details_references
        response = await self._request("GET", "/positions", params=params)
        return response.json()

    async def get_stop_areas(self) -> list[dict]:
        response = await self._request("GET", "/stop-areas")
        return response.json()

    async def get_departures(
        self, stop_area_gid: str, limit: int = 30, time_span_minutes: int = 60
    ) -> dict:
        response = await self._request(
            "GET",
            f"/stop-areas/{stop_area_gid}/departures",
            params={"limit": limit, "timeSpanInMinutes": time_span_minutes},
        )
        return response.json()

    async def get_locations_by_text(self, query: str, limit: int = 10) -> dict:
        response = await self._request(
            "GET",
            "/locations/by-text",
            params={"q": query, "limit": limit, "types": ["stoparea"]},
        )
        return response.json()

    async def get_journeys(
        self, origin_gid: str, destination_gid: str, limit: int = 6
    ) -> dict:
        response = await self._request(
            "GET",
            "/journeys",
            params={
                "originGid": origin_gid,
                "destinationGid": destination_gid,
                "limit": limit,
            },
        )
        return response.json()

    async def get_journey_details(self, details_reference: str) -> dict:
        response = await self._request(
            "GET",
            f"/journeys/{details_reference}/details",
            params={"includes": ["servicejourneycoordinates"]},
        )
        return response.json()

    async def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        url = f"{self._base_url}{path}"
        token = await self._tokens.get_token()
        response = await self._http.request(
            method, url, headers={"Authorization": f"Bearer {token}"}, **kwargs
        )
        if response.status_code == 401:
            # Token may have just expired server-side; refresh once and retry
            self._tokens.invalidate()
            token = await self._tokens.get_token()
            response = await self._http.request(
                method, url, headers={"Authorization": f"Bearer {token}"}, **kwargs
            )
        response.raise_for_status()
        return response
