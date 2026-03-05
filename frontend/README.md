# Photowalker Frontend

React + TypeScript + Vite application for Photowalker. Interactive maps (MapLibre GL JS, Mapbox GL Draw), photo upload and gallery, route creation and browsing.

## Setup and Running

See the root [README](../README.md) and [docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md) for full setup. Quick start:

```bash
npm install
# Copy frontend/.env.example to frontend/.env.local, set VITE_API_URL
make dev-frontend   # or: npm run dev
```

## Tech Stack

- React 18, TypeScript, Vite
- MapLibre GL JS, Mapbox GL Draw, Turf.js
- OpenFreeMap vector tiles (no API key required)
