# Future improvements

Roadmap and deferred decisions. Milestone 1 (live vehicle map) keeps scope tight;
everything here is intentionally *not* built yet.

## Basemap: MapTiler as alternative to OpenFreeMap

The map currently uses [OpenFreeMap](https://openfreemap.org) hosted vector tiles —
free, keyless, no rate limits. If the dark style or reliability proves insufficient,
[MapTiler](https://www.maptiler.com/) hosted styles are the fallback: a more polished
style gallery (including several dark variants) but requires an API key and has a
capped free tier.

## Trip planner refinements (core planner shipped 2026-07-09)

The planner (text search + long-press/right-click map picking, journey list,
route drawing, vehicle focus mode) is implemented. Deferred refinements:

- **Departure time picker** — currently always "leave now"; `/v4/journeys`
  supports `dateTime` + `dateTimeRelatesTo` for leave-at/arrive-by.
- **Walk legs** — journeys with walking connections show only transit legs;
  `connectionLinks` in the API has the walk data (could render dashed lines).
- **"Res härifrån/hit" buttons on the departure board** — today picking is via
  long-press/right-click and text search only.
- **Live journey updates** — re-poll the selected journey for delay changes
  while the route is displayed.

## Favorite lines (stop favorites shipped 2026-07-09)

Stop favorites are done (star on the departure board, Favoriter section in the
filter panel, localStorage). Favorite *lines* still need a UX decision: line
chips are already visibility toggles, so a star needs its own affordance
(long-press? a separate edit mode? star inside an expanded row?). Decide with
the user before building.

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
