---
name: busplanner
description: Runbook for the busplanner project (Gothenburg live transit map, Västtrafik API). Use this whenever working in this repo — starting or stopping the dev servers, verifying changes, probing the Västtrafik API, taking app screenshots, or needing architecture facts (caches, vehicle cap, filter state, panel views). Read it BEFORE running servers or writing verification code, even for small changes.
---

# busplanner runbook

Dark full-screen live map of Gothenburg's public transit (like sl-map.gunnar.se, but
Västtrafik). FastAPI backend proxies the Västtrafik "Planera Resa" v4 API; Vite + TS +
MapLibre GL frontend renders animated vehicles, stops, departure boards, and filters.
Vanilla TS — no UI framework. Everything must work on both desktop and mobile.

## Run / stop

```bash
# backend (port 8000) — from repo root
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000
# frontend (port 5173; proxies /api -> :8000)
cd frontend && npm run dev
# health check
curl -s localhost:8000/api/health        # {"status":"ok"}
# stop
pkill -f "uvicorn app.main:app"; pkill -f "busplanner/frontend.*vite"
```

First-time setup: `python3 -m venv backend/.venv && backend/.venv/bin/pip install -r
backend/requirements.txt`; `npm install` in `frontend/`. Credentials go in
`backend/.env` (gitignored; template in `backend/.env.example`) — OAuth2
client-credentials against `https://ext-api.vasttrafik.se/token`, handled by
`backend/app/vasttrafik/auth.py`.

## Verify changes

1. Backend tests: `cd backend && .venv/bin/python -m pytest tests/ -q`
2. Frontend types: `cd frontend && ./node_modules/.bin/tsc --noEmit`
3. Live API probes (backend must be running; Brunnsparken gid is a known-good stop):
   ```bash
   curl -s "localhost:8000/api/positions?min_lat=57.65&min_lon=11.85&max_lat=57.75&max_lon=12.05"
   curl -s "localhost:8000/api/stops" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['stops']))"  # ~8700
   curl -s "localhost:8000/api/stops/9021014001760000/departures"
   ```
4. Visual check — screenshot the running app (headless, uses cached Playwright
   Chromium + frontend's playwright-core devDependency):
   ```bash
   node .claude/skills/busplanner/scripts/screenshot.mjs out.png              # desktop 1400x900
   node .claude/skills/busplanner/scripts/screenshot.mjs out.png 390 844 8000 touch  # mobile
   ```
   Wait ≥8 s for tiles + first poll; ≥18 s if verifying motion trails. Read the PNG
   to confirm: vehicles as colored dots with line numbers, stops as small gray dots
   (zoom ≥13), sidebar (desktop) or bottom sheet with peek mode-icons (mobile).

## Architecture facts (things that bite)

- **200-vehicle cap**: Västtrafik `/positions` returns max 200 per request. Frontend
  shows an amber pill when at cap. Region-wide tiled fetching is future work.
- **Positions are estimates** (schedule interpolation, not GPS) — popups say so.
- **Backend caches** (in-memory, per-process): positions ~2 s keyed by rounded
  bbox+modes; stops 24 h single entry; departures 10 s per gid. Tests clear them in
  `setup_function`.
- **Coordinates**: Västtrafik uses lat/`long` (stops) or latitude/longitude
  (positions/departures); GeoJSON wants `[lon, lat]`. Mixups put vehicles in the harbor.
- **Departures**: destination from `serviceJourney.directionDetails.shortDirection`;
  line designation from `line.designation` (positions use `line.name`). Boarding-note
  suffixes ("…, Påstigning fram") stripped by `_BOARDING_NOTE` regex in
  `backend/app/vasttrafik/schemas.py`.
- **Filter state** (`frontend/src/state/filterState.ts`): observable singleton,
  persisted in localStorage (`busplanner.filters.v1`, `busplanner.seenLines.v1`).
  `subscribe` fires on any change incl. newly seen lines; `subscribeFilters` only on
  visibility changes — the poller uses the latter (using the former causes refetch loops).
- **Panel** (`frontend/src/ui/panel.ts`): view-stack (root = filters, departure board
  pushed on top; trip planner will be another view). Sidebar ≥768 px, bottom sheet
  below with peek/half/full snap states; peek strip hosts mode-toggle icons.
- **Vehicle animation** (`frontend/src/map/vehicleAnimator.ts`): dead-reckoning
  between 6 s polls, rAF render loop, 15 s motion trails, snap (and trail reset) on
  >~500 m jumps.
- **Config knobs** live in `frontend/src/config.ts` (poll interval, zoom thresholds,
  trail length, panel breakpoint) and `backend/app/config.py` (cache TTLs).

## Production (Vercel)

Deployed on Vercel Hobby: `api/index.py` is the serverless entrypoint (adds
`backend/` to sys.path, imports `app.main:app`); `vercel.json` rewrites
`/api/(.*)` to it and builds the frontend (`frontend/dist` static output).
Root `requirements.txt` = function runtime deps (keep in sync with
`backend/requirements.txt`). Env vars (`VASTTRAFIK_CLIENT_ID/SECRET`) are in
the Vercel dashboard, NOT in the repo. Client construction is lazy via
`backend/app/deps.py:get_vasttrafik` (no lifespan/app.state — serverless-safe);
tests override it with `app.dependency_overrides[get_vasttrafik]`. Backend TTL
caches + OAuth token are per warm instance in prod. Pushes to main auto-deploy.

## Roadmap

`FUTURE_IMPROVEMENTS.md` at repo root. The trip planner shipped 2026-07-09
(`frontend/src/ui/plannerView.ts`, `map/routeLayer.ts`, `map/longPress.ts`,
`state/routeState.ts`; backend `routers/journeys.py`). Remaining planner
refinements and other roadmap items are listed in FUTURE_IMPROVEMENTS.md.
GitHub remote: `carnade/vt-map-planner`.
