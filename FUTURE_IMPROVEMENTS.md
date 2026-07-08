# Future improvements

Roadmap and deferred decisions. Milestone 1 (live vehicle map) keeps scope tight;
everything here is intentionally *not* built yet.

## Basemap: MapTiler as alternative to OpenFreeMap

The map currently uses [OpenFreeMap](https://openfreemap.org) hosted vector tiles —
free, keyless, no rate limits. If the dark style or reliability proves insufficient,
[MapTiler](https://www.maptiler.com/) hosted styles are the fallback: a more polished
style gallery (including several dark variants) but requires an API key and has a
capped free tier.

## Trip / journey planner (next milestone — UX decided with user)

Origin → destination search with realtime-aware suggestions.

- `GET /v4/journeys` and `GET /v4/journeys/{detailsReference}/details`
- `GET /v4/locations/by-text` / `by-coordinates` for origin/destination search

Agreed UX (2026-07-08):

- **Input**: text search with autocomplete AND map picking (tap a stop or
  long-press the map for "from here" / "to here").
- **Results**: journey alternatives list (departure/arrival, duration, changes,
  realtime delays); selecting one draws the route on the map with line colors.
- **Focus mode**: while a route is active, only vehicles relevant to the trip
  are shown — the positions API supports `lineDesignations` filtering for this.
- The planner becomes another view pushed onto the existing panel stack
  (`frontend/src/ui/panel.ts`).

## Favorites / saved stops or lines

Client-side `localStorage` only — no accounts, no database. Natural fit now that
stops and the filter panel exist: a star on the departure board header and/or on
line chips, plus a favorites section at the top of the filter view.

## Nicer vehicle rendering

- Direction-aware icons (chevrons rotated by movement vector) instead of plain
  circles — the animator already computes a per-vehicle velocity that could
  drive icon rotation
- Snap positions to the street/track network instead of straight-line glides

## Deployment

Currently local dev only. Future: pick a host (VPS / Fly.io / Render), HTTPS,
secrets management, reverse proxy serving the built frontend and `/api` together.
