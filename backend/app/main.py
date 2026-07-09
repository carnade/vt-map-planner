from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from .config import get_settings
from .routers import journeys, positions, stops

# Client construction is lazy (app/deps.py) so the same app runs under both
# uvicorn and serverless runtimes — no lifespan/app.state involved.
app = FastAPI(title="busplanner")

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
