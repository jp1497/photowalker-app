# E2E test fixtures only

Files in this directory are used only by Playwright E2E tests. They are **not** served to app users and are **not** included in the production build (Vite builds from `src/` and `public/` only).

- **photo-with-gps.jpg**: Minimal JPEG with EXIF GPS, used by the upload-photo E2E test. Regenerate with `python3 backend/scripts/create_e2e_photo.py` from the repo root.
