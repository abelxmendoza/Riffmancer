import type { SongEdit } from '../../song/edit'
import { DRUM_SETS, INSTRUMENT_LIBRARY, type RealInstrument } from '../../song/instruments'
import type { SoundPart } from '../../song/sound'
import type { SongSpec } from '../../song/spec'

const LABELS: Record<SoundPart, string> = { drums: 'Drums', bass: 'Bass', chords: 'Chords', lead: 'Melody' }
const GROUPS: RealInstrument['group'][] = ['Bass', 'Guitars', 'Keys', 'Strings', 'Brass & winds', 'Mallets & world', 'Voices']
const SELECT = 'mt-1 w-full rounded-xl border border-foreground/10 bg-background px-2 py-1.5 text-sm normal-case tracking-normal text-foreground'

/** Pick who plays each part: a synth, a recorded instrument, or a recorded drum kit. */
export function InstrumentPicker({ song, onEdit }: { song: SongSpec; onEdit: (edit: SongEdit, note: string) => void }) {
  const choose = (part: SoundPart, instrument: string) => onEdit({ type: 'set_instrument', part, instrument }, `${LABELS[part].toLowerCase()} instrument`)
  const others = INSTRUMENT_LIBRARY.filter((instrument) => !instrument.local)
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-4">
      <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/55">Drums
        <select className={SELECT} value={song.kit.set ?? 'synth'} onChange={(event) => choose('drums', event.target.value)}>
          <option value="synth">Synth drums</option>
          {DRUM_SETS.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}
        </select>
      </label>
      {(['bass', 'chords', 'lead'] as const).map((part) => {
        const current = song.sounds[part]
        return (
          <label key={part} className="block text-[11px] font-bold uppercase tracking-wider text-foreground/55">{LABELS[part]}
            <select className={SELECT} value={current.sample ?? 'synth'} onChange={(event) => choose(part, event.target.value)}>
              <option value="synth">{current.sample ? 'Synth' : `Synth: ${current.name}`}</option>
              {GROUPS.map((group) => {
                const local = INSTRUMENT_LIBRARY.filter((instrument) => instrument.local && instrument.group === group)
                return local.length ? (
                  <optgroup key={group} label={group}>
                    {local.map((instrument) => <option key={instrument.id} value={instrument.id}>{instrument.name}</option>)}
                  </optgroup>
                ) : null
              })}
              <optgroup label="More (loads from the web)">
                {others.map((instrument) => <option key={instrument.id} value={instrument.id}>{instrument.name}</option>)}
              </optgroup>
            </select>
          </label>
        )
      })}
    </div>
  )
}
