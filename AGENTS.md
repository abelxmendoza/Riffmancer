# Riffmancer engineering guide

## Product boundary

Riffmancer turns generated songs into editable, verifiable rehearsal material for human musicians. It is not a DAW.

## Engineering rules

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
