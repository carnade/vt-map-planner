"""Lazily constructed singletons, safe for both uvicorn and serverless.

On Vercel each warm function instance builds these on the first request and
reuses them until the instance is recycled (the OAuth token and the routers'
TTL caches are therefore per-instance). Locally this behaves like the old
lifespan wiring, just lazier.
"""

import httpx

from .config import get_settings
from .vasttrafik.auth import TokenManager
from .vasttrafik.client import VasttrafikClient

_vasttrafik: VasttrafikClient | None = None


def get_vasttrafik() -> VasttrafikClient:
    global _vasttrafik
    if _vasttrafik is None:
        settings = get_settings()
        http = httpx.AsyncClient(timeout=10.0)
        _vasttrafik = VasttrafikClient(
            http,
            TokenManager(
                http,
                settings.vasttrafik_token_url,
                settings.vasttrafik_client_id,
                settings.vasttrafik_client_secret,
            ),
            settings.vasttrafik_api_base_url,
        )
    return _vasttrafik
