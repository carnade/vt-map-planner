import os
from unittest.mock import AsyncMock

os.environ.setdefault("VASTTRAFIK_CLIENT_ID", "test-id")
os.environ.setdefault("VASTTRAFIK_CLIENT_SECRET", "test-secret")

from fastapi.testclient import TestClient

from app.main import app
from app.deps import get_vasttrafik
from app.routers import stops as stops_module

RAW_STOP = {"gid": "9021014001760000", "name": "Brunnsparken", "lat": 57.7068, "long": 11.9672}

RAW_DEPARTURE = {
    "detailsReference": "ref1",
    "serviceJourney": {
        "direction": "Vallhamra, Påstigning fram",
        "directionDetails": {"shortDirection": "Vallhamra"},
        "line": {
            "name": "Buss X5",
            "shortName": "X5",
            "designation": "X5",
            "backgroundColor": "#ffff50",
            "foregroundColor": "#d400a2",
            "transportMode": "bus",
        },
    },
    "stopPoint": {"gid": "g1", "name": "Brunnsparken, Göteborg", "platform": "E1"},
    "plannedTime": "2026-07-08T22:04:00.0000000+02:00",
    "estimatedTime": "2026-07-08T22:05:00.0000000+02:00",
    "isCancelled": False,
    "isPartCancelled": False,
}


def setup_function():
    stops_module._stops_cache = None
    stops_module._departures_cache.clear()
    app.dependency_overrides.clear()


def test_stops_shapes_and_drops_invalid():
    with TestClient(app) as client:
        mock = AsyncMock()
        mock.get_stop_areas.return_value = [RAW_STOP, {"gid": "x", "name": "No coords"}]
        app.dependency_overrides[get_vasttrafik] = lambda: mock
        body = client.get("/api/stops").json()
        assert len(body["stops"]) == 1
        assert body["stops"][0] == {
            "gid": "9021014001760000",
            "name": "Brunnsparken",
            "lat": 57.7068,
            "lon": 11.9672,
        }


def test_stops_cached_after_first_fetch():
    with TestClient(app) as client:
        mock = AsyncMock()
        mock.get_stop_areas.return_value = [RAW_STOP]
        app.dependency_overrides[get_vasttrafik] = lambda: mock
        client.get("/api/stops")
        client.get("/api/stops")
        assert mock.get_stop_areas.await_count == 1


def test_departures_shaped():
    with TestClient(app) as client:
        mock = AsyncMock()
        mock.get_departures.return_value = {"results": [RAW_DEPARTURE]}
        app.dependency_overrides[get_vasttrafik] = lambda: mock
        body = client.get("/api/stops/9021014001760000/departures").json()
        assert body["stop_name"] == "Brunnsparken, Göteborg"
        assert body["departures"][0] == {
            "line": "X5",
            "mode": "bus",
            "destination": "Vallhamra",
            "planned_time": "2026-07-08T22:04:00.0000000+02:00",
            "estimated_time": "2026-07-08T22:05:00.0000000+02:00",
            "is_cancelled": False,
            "is_part_cancelled": False,
            "platform": "E1",
            "bg_color": "#ffff50",
            "fg_color": "#d400a2",
            "details_reference": "ref1",
        }


def test_departures_cached_per_gid():
    with TestClient(app) as client:
        mock = AsyncMock()
        mock.get_departures.return_value = {"results": []}
        app.dependency_overrides[get_vasttrafik] = lambda: mock
        client.get("/api/stops/9021014001760000/departures")
        client.get("/api/stops/9021014001760000/departures")
        client.get("/api/stops/9021014001960000/departures")
        assert mock.get_departures.await_count == 2


def test_departures_rejects_bad_gid():
    with TestClient(app) as client:
        app.dependency_overrides[get_vasttrafik] = lambda: AsyncMock()
        assert client.get("/api/stops/not-a-gid/departures").status_code == 422
