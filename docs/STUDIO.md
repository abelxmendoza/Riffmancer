# Studio

The Studio records vocals over an instrumental. It is the first slice of Riffmancer's DAW: a
multitrack timeline, stacked takes, genre vocal chains, a master bus, and WAV export. It runs
entirely in the browser, so it works on the Vercel deployment.

## Workflow

1. **Import** an instrumental (WAV, MP3, M4A, FLAC, OGG). Several files become several tracks, so
   Stem Lab stems work too. The Beat Maker's "Send to Studio" button hands its last take over.
2. **Pick a genre.** Every vocal track that still uses a stock preset switches to that genre's
   chain, and the master bus switches to the genre's master preset.
3. **Record.** Arm a vocal track (●), wear headphones, press Record or R. A count-in plays, then the
   song starts at the playhead. Recording at the same spot again stacks a new take in that clip.
   With Loop on, each pass around the loop becomes a take.
4. **Choose takes** by clicking a clip. The ★ take plays and exports.
5. **Mix** with the track faders, pan, mute/solo, the vocal chain, and the master bus.
6. **Export** a 16-bit WAV mix through the master bus, or a zip of 32-bit float stems (each track
   with its effects, no master processing) plus an all-vocals file when there's more than one vocal
   track.

## How it works

| Piece | Where | Open source used |
| --- | --- | --- |
| Project model, takes, solo/mute | `src/studio/project.ts` | |
| Vocal and master presets | `src/studio/presets.ts` | |
| Time math, take alignment, loop passes, peaks | `src/studio/timing.ts` | |
| Effects chains (live and offline) | `src/studio/engine/chain.ts` | Tone.js (MIT) |
| Transport, players, monitoring, recording | `src/studio/engine/StudioEngine.ts` | Tone.js (MIT) |
| Sample-accurate mic capture | `src/studio/engine/capture.ts` | Web Audio AudioWorklet |
| Offline render, WAV, zip | `src/studio/engine/mixdown.ts` | Tone.js `Offline`, audiobuffer-to-wav (MIT), fflate (MIT) |
| Local storage | `src/studio/storage.ts` | idb-keyval (Apache-2.0) |
| UI | `src/components/studio/` | |
| Fret commands | `src/assistant/studioBrain.ts` | |

**Recording timing.** The mic is opened with echo cancellation, noise suppression and auto gain off.
An AudioWorklet stamps each captured block with its audio-clock frame, so the engine knows exactly
which sample lines up with the moment the song reached the record point. The take is then shifted
by the "Latency fix" setting (round-trip latency, estimated from the browser on first use and
adjustable in Settings).

**Takes are dry.** Recordings are stored without effects, so presets and every knob can change
later. Monitoring (🎧) routes the mic through the armed track's chain so you hear the effect while
singing; it adds a little delay.

**Storage.** The current session (JSON) and its audio live in the browser's IndexedDB. Imported
files are stored exactly as imported; takes are stored as raw samples. Deleted takes and tracks are
pruned. Nothing is uploaded.

## Adding a vocal preset

Add an entry to `VOCAL_PRESETS` in `src/studio/presets.ts` with a genre id from the Beat Maker
genres (or `utility`). Start from `chain({...})`, which fills in the Natural defaults. The preset
tests check value ranges. To let Fret pick it by name, add a pattern to `PRESET_WORDS` in
`src/assistant/studioBrain.ts`.

## Not yet (roadmap)

- Pitch correction / autotune (the core sound of reggaeton and much of modern pop)
- Take comping (picking the best phrase from each take), clip trimming, fades, splitting
- Automation (volume, delay throws on specific words)
- Key and BPM detection for imported instrumentals
- Several saved sessions instead of one current session
- MIDI tracks and an arrangement view, mastering presets beyond the master bus
