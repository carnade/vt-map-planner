# Future improvements

Roadmap and deferred decisions. Milestone 1 (live vehicle map) keeps scope tight;
everything here is intentionally *not* built yet.

## Basemap: MapTiler as alternative to OpenFreeMap

The map currently uses [OpenFreeMap](https://openfreemap.org) hosted vector tiles —
free, keyless, no rate limits. If the dark style or reliability proves insufficient,
[MapTiler](https://www.maptiler.com/) hosted styles are the fallback: a more polished
style gallery (including several dark variants) but requires an API key and has a
capped free tier.

## Departure boards for a stop

Click a stop (or search for one) and see upcoming departures with realtime delays.

- `GET /v4/locations/by-text` and `/v4/locations/by-coordinates` for stop search
- `GET /v4/stop-areas/{stopAreaGid}/departures` for the board itself

## Trip / journey planner

Origin → destination search with realtime-aware suggestions.

- `GET /v4/journeys` and `GET /v4/journeys/{detailsReference}/details`

> **Needs design discussion before implementation** — the UX for this should be
> worked out together (input fields vs. map picking, how results are shown, etc.)
> rather than assumed.

## Favorites / saved stops or lines

Client-side `localStorage` only — no accounts, no database. Small addition once
stop/line browsing UI exists.

## Nicer vehicle rendering

- Direction-aware icons (chevrons rotated by bearing) instead of plain circles
- Smooth interpolation between polls so vehicles glide instead of jumping
- Line-colored markers using Västtrafik's official line colors from the API

## Deployment

Currently local dev only. Future: pick a host (VPS / Fly.io / Render), HTTPS,
secrets management, reverse proxy serving the built frontend and `/api` together.
