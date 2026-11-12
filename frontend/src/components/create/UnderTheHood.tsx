import { useState } from 'react'
import type { MixPart, SynthPart } from '../../beatmaker/engine/types'
import { getGenre, type DrumVoice, type SynthPatch } from '../../beatmaker/genres'
import { cycleVelocity, gridToPattern, parseDrumPattern } from '../../beatmaker/pattern'
import { chordLabel, NOTE_NAMES, SCALE_LABELS, SCALES, type ScaleName } from '../../beatmaker/theory'
import type { SongEdit } from '../../song/edit'
import { sectionName, SONG_PARTS, type Energy, type SongSpec } from '../../song/spec'
import { DrumGrid } from '../beatmaker/DrumGrid'
import { Slider, Toggle } from '../beatmaker/Slider'
import { SynthPanel } from '../beatmaker/SynthPanel'
import { InstrumentPicker } from './InstrumentPicker'

type Tab = 'part' | 'sounds' | 'mix'

interface UnderTheHoodProps {
  song: SongSpec
  section: number
  playStep: number | undefined
  onSection: (index: number) => void
  /** Hand edits go through the same edits Fret uses. `note` groups repeated clicks into one version. */
  onEdit: (edit: SongEdit, note: string) => void
  onSong: (song: SongSpec, note: string) => void
  onAudition: (voice: DrumVoice) => void
}

const PART_LABELS = { drums: 'Drums', bass: 'Bass', chords: 'Chords', lead: 'Melody' } as const

/** Every manual control, kept out of the way until someone wants it. */
export function UnderTheHood({ song, section: index, playStep, onSection, onEdit, onSong, onAudition }: UnderTheHoodProps) {
  const [tab, setTab] = useState<Tab>('part')
  const [synthPart, setSynthPart] = useState<SynthPart>('chords')
  const section = song.sections[index] ?? song.sections[0]
  const position = song.sections.indexOf(section) + 1
  const name = sectionName(song, position - 1)
  const genre = getGenre(song.genreId)

  const toggleStep = (voice: DrumVoice, step: number) => {
    const grid = parseDrumPattern(section.drums)
    grid[voice][step] = cycleVelocity(grid[voice][step])
    onEdit({ type: 'set_drums', section: position, drums: gridToPattern(grid) }, `hand-edited the drums in ${name.toLowerCase()}`)
  }

  return (
    <section aria-label="Under the hood" className="rounded-3xl border border-secondary/30 bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {([['part', 'This part'], ['sounds', 'Sounds'], ['mix', 'Tempo, key & mix']] as [Tab, string][]).map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${tab === value ? 'bg-secondary text-background' : 'bg-foreground/5 text-foreground/60 hover:text-foreground'}`}>{label}</button>
        ))}
      </div>

      {tab === 'part' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-foreground/55">Part
              <select value={position - 1} onChange={(event) => onSection(Number(event.target.value))} className="ml-2 rounded-xl border border-foreground/10 bg-background px-2 py-1.5 text-sm normal-case tracking-normal text-foreground">
                {song.sections.map((other, other_index) => <option key={other.id} value={other_index}>{sectionName(song, other_index)}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-foreground/55">
              Bars
              <button type="button" aria-label="Fewer bars" onClick={() => onEdit({ type: 'set_bars', section: position, bars: Math.max(1, section.bars - 1) }, `changed the length of ${name.toLowerCase()}`)} className="ml-1 h-7 w-7 rounded-full bg-foreground/5 text-foreground hover:bg-foreground/10">−</button>
              <span className="w-6 text-center font-mono text-sm text-foreground">{section.bars}</span>
              <button type="button" aria-label="More bars" onClick={() => onEdit({ type: 'set_bars', section: position, bars: Math.min(32, section.bars + 1) }, `changed the length of ${name.toLowerCase()}`)} className="h-7 w-7 rounded-full bg-foreground/5 text-foreground hover:bg-foreground/10">+</button>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-foreground/55">
              Energy
              {([1, 2, 3] as Energy[]).map((level) => (
                <button key={level} type="button" aria-pressed={section.energy === level} onClick={() => onSong({ ...song, sections: song.sections.map((other) => (other === section ? { ...other, energy: level } : other)) }, `set the energy of ${name.toLowerCase()}`)} className={`ml-1 h-7 w-7 rounded-full font-mono text-sm ${section.energy === level ? 'bg-primary text-background' : 'bg-foreground/5 text-foreground/70'}`}>{level}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {SONG_PARTS.map((part) => (
              <Toggle key={part} on={section.parts[part]} label={PART_LABELS[part]} onClick={() => onEdit({ type: 'parts', section: position, part, on: !section.parts[part] }, `switched parts in ${name.toLowerCase()}`)} />
            ))}
            <Toggle on={section.fill} label="Fill at the end" onClick={() => onEdit({ type: 'set_fill', section: position, on: !section.fill }, `changed the fill in ${name.toLowerCase()}`)} />
          </div>
          <p className="text-xs text-foreground/55">
            Chords: {section.progression.map((degree) => chordLabel(degree, song.root, song.scale, genre.voicing).name).join(' → ')}
          </p>
          <DrumGrid grid={parseDrumPattern(section.drums)} playStep={playStep} onToggle={toggleStep} onAudition={onAudition} />
        </div>
      )}

      {tab === 'sounds' && (
        <>
        <InstrumentPicker song={song} onEdit={onEdit} />
        <SynthPanel part={synthPart} patches={song.sounds} onPart={setSynthPart} onChange={(part, patch: SynthPatch) => onSong({ ...song, sounds: { ...song.sounds, [part]: patch } }, `tweaked the ${part} sound`)} />
        </>
      )}

      {tab === 'mix' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Slider label="Tempo" value={song.bpm} min={60} max={240} step={1} display={`${song.bpm} BPM`} onChange={(bpm) => onSong({ ...song, bpm }, 'changed the tempo')} />
          <Slider label="Swing" value={song.swing} min={0} max={0.6} display={`${Math.round(song.swing * 100)}%`} onChange={(swing) => onSong({ ...song, swing }, 'changed the swing')} />
          <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/55">Key
            <select className="mt-1 w-full rounded-xl border border-foreground/10 bg-background px-2 py-1.5 text-sm normal-case tracking-normal text-foreground" value={song.root} onChange={(event) => onEdit({ type: 'set_key', root: Number(event.target.value) }, 'changed the key')}>
              {NOTE_NAMES.map((note, root) => <option key={note} value={root}>{note}</option>)}
            </select>
          </label>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/55">Mood
            <select className="mt-1 w-full rounded-xl border border-foreground/10 bg-background px-2 py-1.5 text-sm normal-case tracking-normal text-foreground" value={song.scale} onChange={(event) => onEdit({ type: 'set_key', scale: event.target.value as ScaleName }, 'changed the mood')}>
              {(Object.keys(SCALES) as ScaleName[]).map((scale) => <option key={scale} value={scale}>{SCALE_LABELS[scale]}</option>)}
            </select>
          </label>
          {(['drums', 'bass', 'chords', 'lead'] as MixPart[]).map((part) => (
            <Slider key={part} label={part === 'lead' ? 'Melody' : part} value={song.levels[part]} min={0} max={1} display={`${Math.round(song.levels[part] * 100)}%`} onChange={(level) => onSong({ ...song, levels: { ...song.levels, [part]: level } }, 'changed the mix')} />
          ))}
        </div>
      )}
    </section>
  )
}
