"""Vercel serverless entrypoint. All /api/* traffic is rewritten here
(see vercel.json); the FastAPI app routes on the original request path."""

import sys
from pathlib import Path

# backend/ is not a package (no __init__.py); put it on sys.path so the
# `app` package inside it imports exactly as it does under uvicorn.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app  # noqa: E402, F401  (Vercel detects the ASGI `app`)
