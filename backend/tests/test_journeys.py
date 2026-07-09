import os
from unittest.mock import AsyncMock

os.environ.setdefault("VASTTRAFIK_CLIENT_ID", "test-id")
os.environ.setdefault("VASTTRAFIK_CLIENT_SECRET", "test-secret")

from fastapi.testclient import TestClient

from app.main import app
from app.deps import get_vasttrafik
from app.routers import journeys as journeys_module
from app.vasttrafik.schemas import shape_route

RAW_JOURNEY = {
    "detailsReference": "ref-abc",
    "isDeparted": False,
    "tripLegs": [
        {
            "origin": {
                "stopPoint": {
                    "name": "Brunnsparken, Göteborg",
                    "platform": "C1",
                    "latitude": 57.7066,
                    "longitude": 11.9688,
                },
                "plannedTime": "2026-07-09T14:30:00.0000000+02:00",
                "estimatedTime": "2026-07-09T14:35:00.0000000+02:00",
            },
            "destination": {
                "stopPoint": {"name": "Frölunda Torg, Göteborg", "platform": "B"},
                "plannedTime": "2026-07-09T14:55:00.0000000+02:00",
            },
            "isCancelled": False,
            "isPartCancelled": False,
            "serviceJourney": {
                "directionDetails": {"shortDirection": "Tynnered"},
                "line": {
                    "designation": "7",
                    "shortName": "7",
                    "transportMode": "tram",
                    "backgroundColor": "#a05a2c",
                    "foregroundColor": "#ffffff",
                },
            },
        }
    ],
}

RAW_DETAILS = {
    "tripLegs": [
        {
            "callsOnTripLeg": [
                {"latitude": 57.70, "longitude": 11.96},
                {"latitude": 57.68, "longitude": 11.94},
            ],
            "serviceJourneys": [
                {
                    "line": {"name": "7", "transportMode": "tram"},
                    "serviceJourneyCoordinates": [
                        {"latitude": 57.75, "longitude": 12.07},  # before boarding
                        {"latitude": 57.70, "longitude": 11.96},  # boarding
                        {"latitude": 57.69, "longitude": 11.95},
                        {"latitude": 57.68, "longitude": 11.94},  # alighting
                        {"latitude": 57.65, "longitude": 11.91},  # after alighting
                    ],
                }
            ],
        }
    ],
}


def setup_function():
    journeys_module._route_cache.clear()
    app.dependency_overrides.clear()


def test_locations_search():
    with TestClient(app) as client:
        mock = AsyncMock()
        mock.get_locations_by_text.return_value = {
            "results": [
                {"gid": "9021014001760000", "name": "Brunnsparken", "latitude": 57.7, "longitude": 11.97},
                {"gid": "x", "name": "No coords"},
            ]
        }
        app.dependency_overrides[get_vasttrafik] = lambda: mock
        body = client.get("/api/locations", params={"q": "brunn"}).json()
        assert len(body["locations"]) == 1
        assert body["locations"][0]["name"] == "Brunnsparken"


def test_journeys_shaped():
    with TestClient(app) as client:
        mock = AsyncMock()
        mock.get_journeys.return_value = {"results": [RAW_JOURNEY]}
        app.dependency_overrides[get_vasttrafik] = lambda: mock
        body = client.get(
            "/api/journeys",
            params={"origin_gid": "9021014001760000", "dest_gid": "9021014002530000"},
        ).json()
        assert len(body["journeys"]) == 1
        journey = body["journeys"][0]
        assert journey["details_reference"] == "ref-abc"
        leg = journey["legs"][0]
        assert leg["line"] == "7"
        assert leg["mode"] == "tram"
        assert leg["direction"] == "Tynnered"
        assert leg["origin"]["platform"] == "C1"
        assert leg["origin"]["estimated_time"] == "2026-07-09T14:35:00.0000000+02:00"


def test_journeys_rejects_same_origin_dest():
    with TestClient(app) as client:
        app.dependency_overrides[get_vasttrafik] = lambda: AsyncMock()
        resp = client.get(
            "/api/journeys",
            params={"origin_gid": "9021014001760000", "dest_gid": "9021014001760000"},
        )
        assert resp.status_code == 400


def test_route_clips_to_traveled_segment():
    result = shape_route(RAW_DETAILS)
    assert result.line_designations == ["7"]
    leg = result.legs[0]
    # Clipped from 5 coords to the 3 between boarding and alighting
    assert leg.coords == [[11.96, 57.70], [11.95, 57.69], [11.94, 57.68]]


def test_route_cached_by_reference():
    with TestClient(app) as client:
        mock = AsyncMock()
        mock.get_journey_details.return_value = RAW_DETAILS
        app.dependency_overrides[get_vasttrafik] = lambda: mock
        client.get("/api/journeys/ref-abc/route")
        client.get("/api/journeys/ref-abc/route")
        assert mock.get_journey_details.await_count == 1
