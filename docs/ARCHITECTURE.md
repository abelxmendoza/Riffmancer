# Architecture

Riffmancer is split into a React workstation and a FastAPI local-processing service.

```text
Browser workstation
  -> project API
    -> project repository (metadata and immutable source file)
    -> audio inspector (FFprobe subprocess)
  -> streamed source audio
    -> WaveSurfer/Web Audio playback
  -> separation job API
    -> bounded queue (one worker)
      -> replaceable separation provider
        -> Demucs subprocess
    -> atomically published four-stem output
  -> shared stem transport
    -> one AudioContext + common scheduled start time
    -> per-stem gain graph for mute, multi-solo, and volume
```

## Project layout on disk

Each project has an independent directory:

```text
data/projects/<uuid>/
  project.json
  source/<safe-original-name>
  derived/
    stems/<separation-job-uuid>/{vocals,drums,bass,other}.wav
  separation/job.json
  exports/
    stems-<separation-job-uuid>.zip
```

`source` is immutable after a successful import. Future separation and transcription services write only to `derived`; rehearsal packages write to `exports`.

## Service boundaries

- `audio.py` validates and inspects media. FFprobe is an implementation detail.
- `project_repository.py` owns project persistence and path safety.
- `SeparationProvider` keeps Demucs replaceable. `DemucsSeparationProvider` invokes `python -m demucs` with an argument array and no shell interpolation.
- `SeparationManager` persists every state transition, recovers unfinished jobs as interrupted on startup, and serializes heavy work through one bounded worker.
- Providers write only inside a per-job temporary directory. All four files are validated before they are copied into an immutable job-specific output directory.
- `SharedStemTransport` decodes all four WAVs into one `AudioContext`, starts all buffer sources at the same context time, and applies mix decisions through individual gain nodes.
- `transcription.py`, `tablature.py`, and `export.py` remain later boundaries and are not part of Slice 2.
- API routes translate service failures into stable HTTP errors.

SQLite can replace the JSON library index later without changing the project or audio API contracts.
