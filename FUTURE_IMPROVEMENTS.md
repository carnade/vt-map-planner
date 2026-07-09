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

## Stop search by text

A search box (panel root or above the filter view) to find a stop by name and
jump to it / open its departure board — the full stop list is already loaded
client-side via `/api/stops`, so this can be pure client-side fuzzy matching;
alternatively `/v4/locations/by-text` gives server-side matching including
addresses. Pairs naturally with the trip planner's autocomplete work.

## Option to hide motion trails

A "Visa spår" toggle in the filter panel's settings section (next to "Dölj
bussar vid utzoomning"), persisted in localStorage like the other switches —
just gate the trail feature building in `vehicleAnimator.render()` or hide
`TRAIL_LAYER_ID` via `setLayoutProperty("visibility")`.

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

### Scaling the Västtrafik API usage (required before public deployment)

Today the backend proxies per client viewport: positions calls scale with the
number of *unique viewports* (2 s bbox cache dedupes identical views, but 100
users in 100 different areas ≈ 100 distinct upstream calls per poll cycle).
Fine for localhost; not for real users.

The fix is to invert the model:

- **Region-wide fetch loop**: the backend fetches all vehicles for the whole
  Gothenburg region on a fixed interval (tiled into several bounding boxes,
  since `/positions` caps at 200 vehicles per call) and keeps an in-memory
  snapshot. Client requests are served from the snapshot — upstream traffic
  becomes constant (~10–20 calls/interval) regardless of client count. This is
  almost certainly how sl-map.gunnar.se works.
- **Push instead of poll**: WebSocket/SSE from backend to clients, so frontend
  request volume stops scaling with users too.
- Departures could get the same treatment for hot stops if needed, but the
  per-gid 10 s cache already collapses crowds on the same stop to one call.

Also: **check the subscription's rate-limit tier** in the Västtrafik developer
portal (not publicly documented) before any public launch.
