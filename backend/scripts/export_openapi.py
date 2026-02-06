#!/usr/bin/env python3
"""Export OpenAPI spec from FastAPI app. Run from backend/: python scripts/export_openapi.py"""
from __future__ import annotations

import json
import os
import sys

# Add backend to path so 'app' module is found
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _backend_dir)

# Minimal env for Settings validation (export only, no DB/Redis needed)
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/db")
os.environ.setdefault("SECRET_KEY", "export-only")
os.environ.setdefault("GOOGLE_CLIENT_ID", "export")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "export")
os.environ.setdefault("GOOGLE_REDIRECT_URI", "http://localhost:5173/auth/callback")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "export")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "export")
os.environ.setdefault("S3_BUCKET_NAME", "export")

from app.main import app

if __name__ == "__main__":
    out_path = sys.argv[1] if len(sys.argv) > 1 else "shared/openapi.json"
    if not out_path.startswith("/") and "shared" in out_path:
        # Assume project root; backend/scripts/ -> ../../shared/
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        out_path = os.path.join(backend_dir, "..", out_path)
    out_path = os.path.normpath(out_path)
    spec = app.openapi()
    with open(out_path, "w") as f:
        json.dump(spec, f, indent=2)
    print(f"Exported OpenAPI spec to {out_path}")
