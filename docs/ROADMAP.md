# Roadmap

## Slice 1 — Audio workstation foundation

Import and validate songs, persist a project library, display metadata, and provide waveform playback and seeking.

Status: complete.

## Slice 2 — Stem separation

Run Demucs as a cancellable background job, retain job progress, and mix four independently controlled stems.

Status: complete for persisted asynchronous jobs, restart interruption recovery, synchronized playback, controls, and downloads. Cancellation is deferred; closing the app records active work as interrupted on the next start.

## Slice 3 — Bass transcription

Transcribe isolated bass to time-linked, confidence-bearing notes and editable MIDI.

## Slice 4 — Playable tablature

Optimize fretboard positions for playability, alternate tunings, and musician corrections.

## Slice 5 — Band rehearsal export

Package stems, tempo/section charts, corrected tabs, MIDI, and MusicXML for rehearsal.
