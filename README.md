# Riffmancer

Riffmancer is a local-first workstation for turning AI-generated songs into editable, verifiable arrangements that real musicians can rehearse. Slices 1 and 2 provide a working audio library, source player, Demucs stem separation, and a synchronized four-stem mixer. Transcription is intentionally not included yet.

## Current features

- Import WAV, MP3, FLAC, M4A, AAC, or OGG audio (up to 500 MB)
- Validate the actual media with FFprobe rather than trusting the filename
- Store each import in an isolated local project directory
- Browse imported songs and inspect duration, format, sample rate, channels, and file size
- Play, pause, and seek on an interactive waveform
- Return useful errors for invalid or unsupported files
- Queue Demucs separation outside request handlers with one active worker
- Persist queued, running, completed, failed, and interrupted jobs
- Audition vocals, drums, bass, and other on one synchronized Web Audio transport
- Mute, multi-solo, change volume, seek, and switch safely between original and stems
- Download each WAV or all four stems as a ZIP

## Prerequisites

- Python 3.11+
- Node.js 20+
- FFmpeg/FFprobe available on `PATH`

On macOS, FFmpeg can be installed with `brew install ffmpeg`.

## Run locally

In one terminal:

```bash
cd backend
python3.11 -m venv .venv
.venv/bin/pip install -e '.[dev]'
.venv/bin/uvicorn app.main:app --reload --port 8000
```

To enable real stem separation, install the optional Demucs dependency into the same environment:

```bash
cd backend
.venv/bin/pip install -e '.[dev,separation]'
```

The first separation downloads the `htdemucs` model into PyTorch's local cache and therefore needs internet access once. Python/Torch/Demucs can occupy several gigabytes. Audio working space scales with song duration because four uncompressed WAVs exist temporarily before atomic publication; keep at least 10 GB free for an hour-long source, plus space for the Python environment and model cache.

Demucs uses an available supported accelerator through its normal device selection and otherwise runs on CPU. CPU separation is functional but can take substantially longer than the song. Hardware acceleration and memory use depend on the installed PyTorch build; Riffmancer does not claim a percentage because Demucs does not expose a stable machine-readable progress signal.

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` and `/health` to the backend at port 8000.

Imported projects are stored under `data/projects` by default. Set `RIFFMANCER_DATA_DIR` to use a different local directory.

## Verify

```bash
cd backend && .venv/bin/pytest
cd frontend && npm test -- --run
cd frontend && npm run build
```

## API

- `GET /health` — service and FFprobe readiness
- `GET /api/projects` — newest-first project library
- `GET /api/projects/{project_id}` — project metadata
- `POST /api/projects` — multipart upload in the `file` field
- `GET /api/projects/{project_id}/audio` — seekable source audio
- `POST /api/projects/{project_id}/separation` — queue one separation job
- `GET /api/projects/{project_id}/separation` — persisted job status and stem metadata
- `GET /api/projects/{project_id}/separation/stems/{stem}` — seekable WAV; add `?download=true` for attachment
- `GET /api/projects/{project_id}/separation/download` — ZIP containing all four WAVs

`Other` is Demucs' combined remainder and commonly includes guitars, keyboards, and other instruments. Riffmancer does not promise separate lead/rhythm guitar tracks or perfect isolation.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for boundaries and [docs/ROADMAP.md](docs/ROADMAP.md) for the planned slices.
