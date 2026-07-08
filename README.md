# busplanner

A real-time public transit map for Gothenburg, powered by the
[Västtrafik Planera Resa API](https://developer.vasttrafik.se). Inspired by
[SL Live Map](https://sl-map.gunnar.se/): a dark, minimal, full-screen map where
buses and trams drift across the city in real time.

## Architecture

- `backend/` — FastAPI proxy. Owns the Västtrafik OAuth2 credentials, caches the
  bearer token, and exposes a trimmed `/api/positions` endpoint to the frontend.
- `frontend/` — Vite + TypeScript + MapLibre GL. Renders vehicles as a GeoJSON
  layer on OpenFreeMap vector tiles, polling the backend every 2 seconds for the
  current viewport.

## Getting started

### 1. Credentials

Register an application at [developer.vasttrafik.se](https://developer.vasttrafik.se)
and subscribe it to the *Planera Resa v4* API. Then:

```bash
cp backend/.env.example backend/.env
# fill in VASTTRAFIK_CLIENT_ID and VASTTRAFIK_CLIENT_SECRET
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Sanity check: <http://localhost:8000/api/health>

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` to the backend,
so no CORS configuration is needed in dev.

## Notes

- Vehicle positions from Västtrafik are *estimated* (interpolated from schedule +
  realtime data), not raw GPS — same caveat as SL Live Map.
- Buses only appear past a zoom threshold to keep the map readable; trams, trains
  and ferries are always shown.
- The UI must stay responsive — everything is built to work on both mobile and
  desktop (touch gestures, safe-area insets, dynamic viewport height).

See [FUTURE_IMPROVEMENTS.md](FUTURE_IMPROVEMENTS.md) for the roadmap.
