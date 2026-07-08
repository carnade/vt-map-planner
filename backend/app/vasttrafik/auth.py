import asyncio
import base64
import time

import httpx

# Refresh this many seconds before the token actually expires
EXPIRY_MARGIN_SECONDS = 30.0


class TokenManager:
    """Acquires and caches a Västtrafik OAuth2 bearer token (client_credentials)."""

    def __init__(
        self,
        http: httpx.AsyncClient,
        token_url: str,
        client_id: str,
        client_secret: str,
    ) -> None:
        self._http = http
        self._token_url = token_url
        self._basic = base64.b64encode(
            f"{client_id}:{client_secret}".encode()
        ).decode()
        self._token: str | None = None
        self._expires_at: float = 0.0
        self._lock = asyncio.Lock()

    async def get_token(self) -> str:
        if self._token and time.monotonic() < self._expires_at:
            return self._token
        async with self._lock:
            # Another coroutine may have refreshed while we waited for the lock
            if self._token and time.monotonic() < self._expires_at:
                return self._token
            await self._fetch_token()
            assert self._token is not None
            return self._token

    def invalidate(self) -> None:
        """Force a refresh on the next get_token() call (e.g. after a 401)."""
        self._expires_at = 0.0

    async def _fetch_token(self) -> None:
        response = await self._http.post(
            self._token_url,
            headers={
                "Authorization": f"Basic {self._basic}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials"},
        )
        response.raise_for_status()
        payload = response.json()
        self._token = payload["access_token"]
        expires_in = float(payload.get("expires_in", 600))
        self._expires_at = time.monotonic() + expires_in - EXPIRY_MARGIN_SECONDS
