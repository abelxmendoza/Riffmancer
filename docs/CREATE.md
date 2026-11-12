# Create: Fret as the producer

The Create screen (`#/create`) is the main way to make music in Riffmancer. You tell Fret what you want and Fret writes or edits the song.

## How it fits together

- **Song Spec** (`frontend/src/song/spec.ts`): a song is plain data. Title, genre, tempo, key, sounds, and a list of sections (intro, verse, chorus, drop, bridge, breakdown, build, break, outro). Each section has bars, energy (1–3), a chord progression, a 16-step drum pattern, bass and chord rhythms, a melody, which parts play, and whether it ends with a fill.
- **Generator** (`generate.ts`): builds a full song from a genre data file, with a genre-specific song shape and seeded randomness.
- **Edits** (`edit.ts`): every change is a `SongEdit` (new song, change genre, tempo, key, energy, feel, regenerate a layer, add/remove/move sections, write patterns, sounds, levels). `applyEdit` validates and explains each change in one line, which becomes the version note.
- **Player** (`player.ts`): `SongConductor` walks the sections and feeds the shared `AudioEngine` (via `AudioEngine.withTicker`). It handles fills, crashes into new sections, energy-scaled velocity, the melody, start-from-section and loop-a-section.
- **Versions** (`history.ts`): every Fret change is a new version with undo, redo and a version picker. Hand edits from the drawer merge into one version per control.
- **Fret's brains**: `assistant/songBrain.ts` understands common requests offline. Anything it doesn't understand goes to `/api/fret` when `ANTHROPIC_API_KEY` is set on the server; Claude answers with tool calls from `song/tools.ts`, one per `SongEdit`.

## Things to try

"make a dark post punk song", "drum and bass at 174 in F minor", "heavier chorus", "half-time breakdown", "new drums in the verse", "add a bridge", "cut the last chorus", "make it reggaeton", "loop the chorus", "undo".

## Next steps (planned)

1. Sampled drum kits and instruments per genre (replacing the synthesized sounds).
2. Record or upload audio, analyse it in the browser (tempo, key, chords, energy) and write a similar original song.
3. Send to Studio, WAV/MIDI export, show in the Player library.
4. Optional AI audio rendering.
