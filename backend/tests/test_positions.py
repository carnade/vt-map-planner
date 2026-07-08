import os
import time
from unittest.mock import AsyncMock

os.environ.setdefault("VASTTRAFIK_CLIENT_ID", "test-id")
os.environ.setdefault("VASTTRAFIK_CLIENT_SECRET", "test-secret")

from fastapi.testclient import TestClient

from app.main import app
from app.routers import positions as positions_module

RAW_POSITION = {
    "detailsReference": "abc123",
    "latitude": 57.7,
    "longitude": 11.97,
    "direction": "Angered",
    "line": {
        "name": "6",
        "transportMode": "tram",
        "backgroundColor": "#00394d",
        "foregroundColor": "#ffffff",
    },
}


def make_client(raw_response):
    client = TestClient(app)
    mock = AsyncMock()
    mock.get_positions.return_value = raw_response
    app.state.vasttrafik = mock
    return client, mock


def setup_function():
    positions_module._cache.clear()


def test_health():
    with TestClient(app) as client:
        assert client.get("/api/health").json() == {"status": "ok"}


def test_positions_shapes_response():
    with TestClient(app) as client:
        mock = AsyncMock()
        mock.get_positions.return_value = [RAW_POSITION, {"latitude": None}]
        app.state.vasttrafik = mock
        resp = client.get(
            "/api/positions",
            params={"min_lat": 57.6, "min_lon": 11.8, "max_lat": 57.8, "max_lon": 12.1},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["vehicles"]) == 1
        vehicle = body["vehicles"][0]
        assert vehicle == {
            "id": "abc123",
            "line": "6",
            "mode": "tram",
            "lat": 57.7,
            "lon": 11.97,
            "destination": "Angered",
            "bg_color": "#00394d",
            "fg_color": "#ffffff",
        }


def test_positions_rejects_huge_bbox():
    with TestClient(app) as client:
        app.state.vasttrafik = AsyncMock()
        resp = client.get(
            "/api/positions",
            params={"min_lat": 50.0, "min_lon": 5.0, "max_lat": 60.0, "max_lon": 20.0},
        )
        assert resp.status_code == 400


def test_positions_served_from_cache_within_ttl():
    with TestClient(app) as client:
        mock = AsyncMock()
        mock.get_positions.return_value = [RAW_POSITION]
        app.state.vasttrafik = mock
        params = {"min_lat": 57.6, "min_lon": 11.8, "max_lat": 57.8, "max_lon": 12.1}
        client.get("/api/positions", params=params)
        client.get("/api/positions", params=params)
        assert mock.get_positions.await_count == 1
