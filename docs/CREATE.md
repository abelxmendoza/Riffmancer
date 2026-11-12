# Create: Fret as the producer

The Create screen (`#/create`) is the main way to make music in Riffmancer. You tell Fret what you want and Fret writes or edits the song.

## How it fits together

- **Song Spec** (`frontend/src/song/spec.ts`): a song is plain data. Title, genre, tempo, key, sounds, and a list of sections (intro, verse, chorus, drop, bridge, breakdown, build, break, outro). Each section has bars, energy (1–3), a chord progression, a 16-step drum pattern, bass and chord rhythms, a melody, which parts play, and whether it ends with a fill.
- **Generator** (`generate.ts`): builds a full song from a genre data file, with a genre-specific song shape and seeded randomness.
- **Edits** (`edit.ts`): every change is a `SongEdit` (new song, change genre, tempo, key, energy, feel, regenerate a layer, add/remove/move sections, write patterns, sounds, levels). `applyEdit` validates and explains each change in one line, which becomes the version note.
- **Player** (`player.ts`): `SongConductor` walks the sections and feeds the shared `AudioEngine` (via `AudioEngine.withTicker`). It handles fills, crashes into new sections, energy-scaled velocity, the melody, start-from-section and loop-a-section.
- **Versions** (`history.ts`): every Fret change is a new version with undo, redo and a version picker. Hand edits from the drawer merge into one version per control.
- **Sounds in plain words** (`sound.ts`): "fuzzy wide guitars", "a deep gliding 808", "glassy bells", "roomy punchy drums". Instruments (808, sub, reese, piano, rhodes, organ, strings, pad, bells, flute, chiptune and more) give a starting sound; describing words (dark, bright, distorted, clean, spacey, dry, wide, fat, thin, punchy, soft, plucky, long, gliding, resonant, roomy, low, high) nudge it. If the part already is that instrument ("fuzzier guitars" on a guitar), it is tweaked instead of replaced. The `design_sound` edit applies it; the live AI can also send exact numbers, clamped to safe ranges.
- **Styles** (`styles.ts`): about 45 named styles (shoegaze, darkwave, doom, djent, black metal, pop punk, hardcore, liquid dnb, neurofunk, jungle, dubstep, dembow, latin trap, trap, phonk, lo-fi, techno, synthwave and more). Each is one of the seven genre engines plus a tempo, mood, drum feel and sound descriptions. Adding one is one line of data. The live AI can also invent a style label on top of the closest engine.
- **Vocals** (`studio/vocalSound.ts`, `studio/userPresets.ts`): plain words about a voice ("dreamy with lots of reverb", "gritty megaphone shout", "dry and upfront with a slapback") become a Studio vocal chain. Fret saves it under "Your presets" in this browser. Every style has a usual vocal sound (`STYLE_VOCALS`), so "vocal preset for this song" fits the song. "Sing over it" (or "record vocals over this") plays the song once in real time while recording it, hands it to the Studio, and sets the tempo, genre and vocal preset there. Things the Studio can't do yet (auto-tune, vocoder) are named, not faked.
- **Copy a song's vocal sound** (`studio/analysis/vocalMatch.ts`, `components/studio/MatchPanel.tsx`): upload a song or record it playing near the mic (up to 30 s), and the browser estimates the effects on the voice: reverb amount and tail (from the gaps after lines), echo time (repeats of the last syllable, plus a slapback check), brightness, grit, stereo width, compression and phone-like band limits. Each reading has a confidence, and the result is saved under Your presets. It is an estimate: on a full mix the instruments colour every reading. Nothing is uploaded. Ask Fret "copy the vocal effects from a song I like" from any page.
- **Fret's brains**: `assistant/songBrain.ts` understands common requests offline. Anything it doesn't understand goes to `/api/fret` when `ANTHROPIC_API_KEY` is set on the server; Claude answers with tool calls from `song/tools.ts`, one per `SongEdit`.

## Things to try

"make a dark post punk song", "drum and bass at 174 in F minor", "heavier chorus", "half-time breakdown", "new drums in the verse", "add a bridge", "cut the last chorus", "make it reggaeton", "loop the chorus", "undo".

Describe it like Suno: "shoegaze song with fuzzy wide guitars and a deep sub bass", "dark trap beat with a gliding 808 and glassy bells", "make it synthwave", "make the bass an 808", "piano chords", "roomy live drums", "guitars with no distortion".

## Next steps (planned)

1. Sampled instruments beyond drums, and CC0 starter kits that work without a key.
2. Record or upload audio, analyse it in the browser (tempo, key, chords, energy) and write a similar original song.
3. Send to Studio, WAV/MIDI export, show in the Player library.
4. Optional AI audio rendering.

## Real drums from Freesound

- `song/samples.ts` (pure): `SampleRef`, how to search Freesound for one drum (`sampleSearch`), licence reading (`licenseOf`, `commercialOk`, `creditLine`), and how Fret reads "use a real snare" or "back to synth drums".
- A song stores its samples in `SongSpec.samples` (one per drum). The `set_sample` edit puts one on or takes it off; only `cdn.freesound.org` previews are accepted.
- `api/sounds.ts` is the Vercel function that searches with `FREESOUND_API_KEY` (server only) and can proxy a preview if the CDN blocks the browser. Searches default to CC0 and CC BY sounds, which are fine for releases (CC BY needs a credit, shown on the song card).
- `services/freesound.ts` calls it; `useSongPlayer` downloads and decodes each sample once, and `DrumKit.setSample` plays it through the kit's drive, room and bus instead of the synth drum.
- In the chat: "use a real snare, trashy", "real recorded drums", "another snare", "back to synth drums".

## Colour themes

- `theme/themes.ts` has six themes, one per genre (ids match the Player's visualizer themes). `theme/store.ts` saves the choice and writes the colours as CSS variables on `<html>`; Tailwind's `bg-primary`, `text-foreground/60` and so on read them, so every screen follows.
- "Match my song" (on by default) switches the theme when the Create song or Studio session changes genre. Fret understands "blood moon theme", "make it look punk" and "match my song".
- The skull artwork is recoloured per theme with a CSS filter (`.emblem`); Blood Moon uses an SVG colour matrix in `index.html`.
