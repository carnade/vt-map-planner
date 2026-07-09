from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from .config import get_settings
from .routers import journeys, positions, stops
from .vasttrafik.auth import TokenManager
from .vasttrafik.client import VasttrafikClient


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    http = httpx.AsyncClient(timeout=10.0)
    tokens = TokenManager(
        http,
        settings.vasttrafik_token_url,
        settings.vasttrafik_client_id,
        settings.vasttrafik_client_secret,
    )
    app.state.settings = settings
    app.state.vasttrafik = VasttrafikClient(
        http, tokens, settings.vasttrafik_api_base_url
    )
    yield
    await http.aclose()


app = FastAPI(title="busplanner", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1024)

app.include_router(positions.router, prefix="/api")
app.include_router(stops.router, prefix="/api")
app.include_router(journeys.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
