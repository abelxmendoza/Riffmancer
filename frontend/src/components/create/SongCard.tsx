import { getGenre } from '../../beatmaker/genres'
import { NOTE_NAMES, SCALE_LABELS } from '../../beatmaker/theory'
import type { SongHistory } from '../../song/history'
import { formatDuration, sectionName, type SectionKind, type SongSpec } from '../../song/spec'
import { PauseIcon, PlayIcon } from '../Icons'
import type { Position } from './useSongPlayer'

export const KIND_COLORS: Record<SectionKind, string> = {
  intro: 'bg-sky-400/25 border-sky-300/40',
  verse: 'bg-foreground/10 border-foreground/20',
  build: 'bg-amber-400/20 border-amber-300/40',
  chorus: 'bg-primary/30 border-primary/60',
  drop: 'bg-primary/30 border-primary/60',
  bridge: 'bg-violet-400/25 border-violet-300/40',
  breakdown: 'bg-red-500/25 border-red-400/50',
  break: 'bg-sky-400/15 border-sky-300/30',
  outro: 'bg-sky-400/25 border-sky-300/40',
}

const SHORT: Record<SectionKind, string> = { intro: 'I', verse: 'V', build: 'Bu', chorus: 'C', drop: 'D', bridge: 'Br', breakdown: 'BD', break: 'Bk', outro: 'O' }

/** "V2", "C3": section names that fit on a phone. */
function shortName(song: SongSpec, index: number): string {
  const kind = song.sections[index].kind
  const same = song.sections.filter((section) => section.kind === kind).length
  const number = song.sections.slice(0, index + 1).filter((section) => section.kind === kind).length
  return same > 1 ? `${SHORT[kind]}${number}` : SHORT[kind]
}

interface SongCardProps {
  song: SongSpec
  history: SongHistory
  playing: boolean
  position: Position | undefined
  selected: number | undefined
  loopSection: number | undefined
  drawerOpen: boolean
  onPlay: () => void
  onSelect: (index: number) => void
  onPlayFrom: (index: number) => void
  onLoop: (index: number | undefined) => void
  onAskAbout: (index: number) => void
  onUndo: () => void
  onRedo: () => void
  onVersion: (index: number) => void
  onToggleDrawer: () => void
  bouncing: boolean
  onSingOver: () => void
}

/** The one thing on screen besides Fret: the song, its parts, and its versions. */
export function SongCard(props: SongCardProps) {
  const { song, history, playing, position, selected, loopSection } = props
  const genre = getGenre(song.genreId)
  const key = `${NOTE_NAMES[song.root]} ${SCALE_LABELS[song.scale].split(' ')[0].toLowerCase()}`
  const selectedIndex = selected !== undefined && selected < song.sections.length ? selected : undefined
  return (
    <section aria-label="Your song" className="rounded-3xl border border-foreground/10 bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={props.onPlay}
          aria-label={playing ? 'Stop' : 'Play the song'}
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary text-background shadow-[0_0_30px_rgba(163,230,53,0.25)] hover:bg-secondary"
        >
          {playing ? <PauseIcon className="h-6 w-6" /> : <PlayIcon className="h-6 w-6" />}
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-black text-foreground sm:text-3xl">{song.title}</h1>
          <p className="mt-0.5 truncate text-xs font-bold text-foreground/50">{song.style ?? genre.name} · {song.bpm} BPM · {key} · {formatDuration(song)}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-1" role="group" aria-label="Song parts">
        {song.sections.map((section, index) => {
          const current = position?.sectionIndex === index
          const progress = current && position ? (position.barInSection * 16 + position.step + 1) / (section.bars * 16) : 0
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => props.onSelect(index)}
              style={{ flexGrow: section.bars, flexBasis: 0 }}
              aria-pressed={selectedIndex === index}
              aria-label={`${sectionName(song, index)}, ${section.bars} bars`}
              className={`relative h-14 min-w-0 overflow-hidden rounded-xl border px-1.5 text-left transition ${KIND_COLORS[section.kind]} ${selectedIndex === index ? 'ring-2 ring-foreground' : 'hover:brightness-125'}`}
            >
              {current && <span className="absolute inset-y-0 left-0 bg-foreground/15" style={{ width: `${progress * 100}%` }} />}
              <span className="relative block truncate text-[11px] font-black uppercase tracking-wide text-foreground/85"><span className="sm:hidden">{shortName(song, index)}</span><span className="hidden sm:inline">{sectionName(song, index)}</span></span>
              <span className="relative hidden truncate font-mono text-[10px] text-foreground/50 sm:block">{section.bars} bars{loopSection === index ? ' · loop' : ''}</span>
              <span className="relative mt-0.5 flex gap-0.5" aria-hidden="true">
                {Array.from({ length: section.energy }, (_, dot) => <span key={dot} className="h-1 w-1 rounded-full bg-foreground/60" />)}
              </span>
            </button>
          )
        })}
      </div>

      {selectedIndex !== undefined && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-black uppercase tracking-wider text-foreground/60">{sectionName(song, selectedIndex)}</span>
          <button type="button" onClick={() => props.onPlayFrom(selectedIndex)} className="rounded-full border border-foreground/15 px-3 py-1.5 font-bold text-foreground/75 hover:border-primary hover:text-foreground">▶ Play from here</button>
          <button type="button" onClick={() => props.onLoop(loopSection === selectedIndex ? undefined : selectedIndex)} aria-pressed={loopSection === selectedIndex} className={`rounded-full border px-3 py-1.5 font-bold ${loopSection === selectedIndex ? 'border-primary bg-primary text-background' : 'border-foreground/15 text-foreground/75 hover:border-primary hover:text-foreground'}`}>⟲ Loop it</button>
          <button type="button" onClick={() => props.onAskAbout(selectedIndex)} className="rounded-full border border-foreground/15 px-3 py-1.5 font-bold text-foreground/75 hover:border-primary hover:text-foreground">Ask Fret to change it</button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-foreground/10 pt-3">
        <button type="button" onClick={props.onUndo} disabled={history.index <= 0} className="rounded-full px-3 py-1.5 text-xs font-bold text-foreground/60 hover:bg-foreground/5 hover:text-foreground disabled:opacity-30">↶ Undo</button>
        <button type="button" onClick={props.onRedo} disabled={history.index >= history.versions.length - 1} className="rounded-full px-3 py-1.5 text-xs font-bold text-foreground/60 hover:bg-foreground/5 hover:text-foreground disabled:opacity-30">↷ Redo</button>
        <label className="order-last min-w-0 basis-full sm:order-none sm:basis-0 sm:flex-1">
          <span className="sr-only">Versions</span>
          <select value={history.index} onChange={(event) => props.onVersion(Number(event.target.value))} className="w-full truncate rounded-full border border-foreground/10 bg-background px-3 py-1.5 text-xs text-foreground/75">
            {history.versions.map((version, index) => (
              <option key={`${version.at}-${index}`} value={index}>v{index + 1} · {version.note}</option>
            )).reverse()}
          </select>
        </label>
        <button type="button" onClick={props.onSingOver} aria-pressed={props.bouncing} title="Record this song into the Studio and sing over it" className={`rounded-full border px-3 py-1.5 text-xs font-bold ${props.bouncing ? 'border-red-400 bg-red-500/20 text-red-200' : 'border-primary/50 text-primary hover:bg-primary hover:text-background'}`}>
          {props.bouncing ? '● Recording… stop' : '🎤 Sing over it'}
        </button>
        <button type="button" onClick={props.onToggleDrawer} aria-expanded={props.drawerOpen} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${props.drawerOpen ? 'border-secondary text-secondary' : 'border-foreground/15 text-foreground/60 hover:text-foreground'}`}>
          {props.drawerOpen ? 'Close the hood' : 'Under the hood'}
        </button>
      </div>
    </section>
  )
}
