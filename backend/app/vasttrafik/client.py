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
        response = await self._request("GET", "/positions", params=params)
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
