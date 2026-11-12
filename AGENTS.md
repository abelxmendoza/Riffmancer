# Riffmancer engineering guide

## Product boundary

Riffmancer's workspaces:

- **Create** (`#/create`, the main screen) is where people make songs by talking to Fret. Fret writes a whole song (sections, drums, chords, bass, melody) and edits it on request; every manual control sits in the closed "Under the hood" drawer. Keep this screen uncluttered: new abilities go through Fret first.
- The **Beat Maker** (shown as "Jam" in the nav) helps people without production knowledge make beats and instrumentals with a MIDI keyboard. Keep it guided and genre-driven: it should not grow into a full DAW timeline. The main genres are post punk, metal, punk, drum & bass, and reggaeton.
- The **Stem Lab** turns generated songs into editable, verifiable rehearsal material for human musicians.

## Engineering rules

- Beat Maker musical logic (`frontend/src/beatmaker/{theory,pattern,conductor,session}.ts`, `input/keymap.ts`) stays free of audio code so it can be unit-tested. Only `beatmaker/engine/` imports Tone.js, and it is loaded lazily on the first user gesture.
- Song logic lives in `frontend/src/song/` (`spec.ts` the Song Spec, `generate.ts`, `edit.ts`, `player.ts`, `history.ts`, `tools.ts`) and stays free of audio code. Every change to a song is a `SongEdit` applied by `applyEdit`; the offline brain (`assistant/songBrain.ts`), the live AI tools (`song/tools.ts`, `api/fret.ts`) and the drawer all use it. A new kind of change gets a `SongEdit`, a tool in `SONG_TOOLS`, phrase parsing in `songBrain.ts`, and tests.
- New genres are data files in `frontend/src/beatmaker/genres/`, registered in `genres/index.ts`. The registry tests validate them.
- Fret, the assistant (`frontend/src/assistant/`), drives the Beat Maker only through the command bus in `assistant/bus.ts`. New Beat Maker features that Fret should control get a `BeatAction`, a handler in `BeatMaker.tsx`, and parsing plus tests in `assistant/engine.ts`. The offline brain must keep working without any network.
- The live AI (`frontend/api/chat.ts`, and `frontend/api/fret.ts` for song edits) is optional and only runs when `ANTHROPIC_API_KEY` is set on the server. Never call it from the client for things the offline brain can handle, and never put the key in client code.
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
