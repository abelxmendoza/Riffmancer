# Riffmancer engineering guide

## Product boundary

Riffmancer has two workspaces:

- The **Beat Maker** helps people without production knowledge make beats and instrumentals with a MIDI keyboard. Keep it guided and genre-driven: it should not grow into a full DAW timeline. The main genres are post punk, metal, punk, drum & bass, and reggaeton.
- The **Stem Lab** turns generated songs into editable, verifiable rehearsal material for human musicians.

## Engineering rules

- Beat Maker musical logic (`frontend/src/beatmaker/{theory,pattern,conductor,session}.ts`, `input/keymap.ts`) stays free of audio code so it can be unit-tested. Only `beatmaker/engine/` imports Tone.js, and it is loaded lazily on the first user gesture.
- New genres are data files in `frontend/src/beatmaker/genres/`, registered in `genres/index.ts`. The registry tests validate them.
- Keep audio engines behind service interfaces. UI and API code must not depend directly on Demucs, Basic Pitch, or future model internals.
- Never present inferred musical information as certain. Preserve confidence and source-audio timing.
- Every generated transcription must remain editable.
- Keep original audio immutable after import. Derived files belong in project subdirectories.
- Prefer local processing and local storage. Do not add network uploads or telemetry without an explicit product decision.
- Reject unsupported or malformed media at the API boundary with actionable errors.
- Add focused tests for backend behavior and frontend logic with every slice.
- Do not begin a later milestone until the current slice's definition of done passes.

## Commands

- Backend tests: `cd backend && .venv/bin/pytest`
- Optional Demucs install: `cd backend && .venv/bin/pip install -e '.[separation]'`
- Backend dev: `cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000`
- Frontend tests: `cd frontend && npm test -- --run`
- Frontend dev: `cd frontend && npm run dev`
- Frontend build: `cd frontend && npm run build`
