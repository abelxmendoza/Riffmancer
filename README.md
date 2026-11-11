# Riffmancer

Riffmancer is a local-first music workstation with two workspaces:

- **Beat Maker** lets you make beats and instrumentals with a MIDI keyboard, even if you don't know music theory. Pick a genre and press play, and a backing band starts. Then play chords and melodies on top. Every key you press fits the song.
- **Stem Lab** turns AI-generated songs into stems that real musicians can rehearse with.

## Beat Maker

- Genre presets for **post punk, metal, punk, drum & bass, and reggaeton**, plus boom bap and house. Each preset includes drums, a bass line, a chord rhythm, a chord progression, a key, and its own sounds.
- **Band mode.** Keys below the split play chords, and the drums and bass follow you. Keys above the split play the synthesizer.
- **No wrong notes.** Synth notes snap to the song's key, and each chord key always gives a chord that fits.
- **Drum pads.** Use the on-screen pads, or switch the keyboard to drum mode. MIDI channel 10 always plays drums, and GM drum notes are supported.
- **Editable 16-step drum grid** with beat A/B, Fill (a drum fill followed by a crash), Mutate (genre-aware variations), and Reset.
- **Capture.** While the band plays, drum hits you play are written into the beat, and chords you play are written into the progression.
- **Synthesizer** for the melody, chord, and bass sounds. It has presets, waveform, brightness, resonance, pluck, ADSR, drive, chorus, echo, space, thickness, glide, and octave controls.
- **Record audio.** Records everything you hear to a downloadable file.
- No MIDI keyboard? Use the computer keyboard: 1–8 for drums, Z–M for chords, A–' for the synth, and Space to play or stop.
- Your work is saved in the browser automatically.

MIDI uses the browser's Web MIDI API (Chrome, Edge, Opera, and Firefox after a permission prompt). Sound is built on [Tone.js](https://tonejs.github.io/) (MIT). All drums are synthesized, so no sample packs or sample licenses are needed. The Beat Maker runs entirely in the browser and doesn't need the Python backend. See [docs/BEAT_MAKER.md](docs/BEAT_MAKER.md) for how it works and how to add a genre.

## Fret, the in-app assistant

Fret is Riffmancer's mascot: a skull-bot roadie with a guitar-headstock crest who lives in the chat bar at the bottom of every page. Type what you want in plain words, such as "make a metal beat at 165 bpm", "faster", "add a fill", "key of D minor", "make the synth darker", or "how do I play chords?", and Fret runs the band for you.

Fret's built-in brain runs entirely in the browser and needs no account or key. To let Fret answer open-ended questions too, set `ANTHROPIC_API_KEY` on the server (for example in the Vercel project's environment variables). The `frontend/api/chat.ts` function then answers questions the built-in brain doesn't know, using Claude. Without the key, nothing leaves the browser.

The site opens on a landing page (`#/`), with the Beat Maker at `#/beats` and the Stem Lab at `#/stems`.

## Stem Lab features

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

Open [http://localhost:5173](http://localhost:5173). The Beat Maker works with just `npm run dev`. The Stem Lab needs the backend, and Vite proxies `/api` and `/health` to the backend at port 8000.

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

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for boundaries, [docs/ROADMAP.md](docs/ROADMAP.md) for the planned slices, and [docs/BRAND.md](docs/BRAND.md) for the Toxic Signal visual system.
