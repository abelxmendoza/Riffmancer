# Beat Maker

The Beat Maker is a browser-only instrument. It has no backend dependency.

```text
MIDI keyboard (Web MIDI) ─┐
Computer keyboard ────────┼─> keymap.ts ──> PlayAction (drum | chord | lead)
On-screen keys and pads ──┘                     │
                                                v
                      BeatMaker.tsx (React state = Session, saved to localStorage)
                                                │
                     AudioEngine (Tone.js, lazy-loaded on first click or key)
                       ├─ Tone Transport, one callback per 16th note ──> Conductor.tick()
                       │     Conductor (pure): drum grid, fill and crash, chord per bar,
                       │     bass and chord events from genre patterns
                       ├─ DrumKit x2 (sequenced band and live pads), all synthesized
                       ├─ SynthChannel: bass, chords, lead
                       │     PolySynth(MonoSynth) → drive → cabinet → chorus → delay → reverb
                       └─ mixer → limiter → speakers, plus Tone.Recorder for "Record audio"
```

## Keyboard modes

| Mode | Keys below the split (default C4) | Keys above the split |
| --- | --- | --- |
| Band | Chords. White keys C–B are scale degrees 1–7, and black keys repeat the degree below them. The band follows the last chord you pressed. | Synthesizer, snapped to the key when "No wrong notes" is on |
| Synth only | Synthesizer | Synthesizer |
| Drum pads | GM drum notes (35–59), or a pad per key of the octave | Same |

MIDI channel 10 always plays drums, whatever the mode is.

## Adding a genre

1. Copy `frontend/src/beatmaker/genres/punk.ts` to a new file and change its values:
   - `drums.main`, `drums.alt`, `drums.fill`: one 16-character string per drum. `X` is an accent, `x` a hit, `o` a ghost note, and `.` a rest.
   - `bass`: 16 characters relative to the current chord. `R`/`r` is the root (loud/soft), `3`, `5`, `7` are chord tones, `8` is the octave, `-` holds, and `.` is a rest.
   - `chords`: 16 characters. `X`/`x` is a hit, `m` a palm-muted chug, `-` holds, and `.` is a rest.
   - `progression`: one scale degree (1–7) per bar. `voicing` is `power`, `triad`, or `seventh`.
   - `sounds`: synth patches for bass, chords, and lead, plus a drum kit patch.
2. Add it to `GENRES` in `genres/index.ts`. Set `primary: true` to show it as a big card.
3. Run `npm test -- --run`. The registry tests check pattern lengths, characters, and tempo ranges.

The new genre's sounds automatically appear as synthesizer presets.

## Limitations

- Web MIDI is not available in Safari. Players there can use the computer keyboard or the on-screen keys.
- Recordings use the browser's MediaRecorder format (usually WebM/Opus, or MP4 in some browsers).
- Drums are synthesized approximations, not sampled acoustic kits.
