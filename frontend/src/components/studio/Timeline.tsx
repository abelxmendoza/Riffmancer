import { useRef } from 'react'
import { activeTake, type Clip, type StudioProject, type Track } from '../../studio/project'
import { secondsPerBar, snapToBeat } from '../../studio/timing'
import { Waveform } from './Waveform'

const WIDE_HEADER = 232
const NARROW_HEADER = 150
const LANE = 76

interface TimelineProps {
  project: StudioProject
  buffers: Map<string, AudioBuffer>
  pixelsPerSecond: number
  length: number
  selectedTrackId?: string
  selectedClipId?: string
  playheadRef: React.RefObject<HTMLDivElement | null>
  onSeek: (seconds: number) => void
  onSelectTrack: (id: string) => void
  onSelectClip: (trackId: string, clipId: string) => void
  onMoveClip: (trackId: string, clipId: string, start: number) => void
  onTrack: (id: string, changes: Partial<Track>) => void
  onRemoveTrack: (id: string) => void
}

/** Multitrack arrangement: sticky track headers on the left, scrolling clip lanes on the right. */
export function Timeline(props: TimelineProps) {
  const { project, pixelsPerSecond: pps, length } = props
  const HEADER = typeof window !== 'undefined' && window.innerWidth < 640 ? NARROW_HEADER : WIDE_HEADER
  const width = length * pps
  const bar = secondsPerBar(project.bpm, project.beatsPerBar)
  const bars = Math.ceil(length / bar)
  const barStep = bar * pps < 28 ? 4 : bar * pps < 56 ? 2 : 1

  const seekFromEvent = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    props.onSeek(Math.max(0, (event.clientX - rect.left) / pps))
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-foreground/10 bg-surface" role="region" aria-label="Timeline">
      <div className="relative" style={{ width: HEADER + width, minWidth: '100%' }}>
        {/* Ruler */}
        <div className="flex h-8 border-b border-foreground/10">
          <div className="sticky left-0 z-20 flex shrink-0 items-center border-r border-foreground/10 bg-surface px-3 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40" style={{ width: HEADER }}>Bars</div>
          <div className="relative cursor-pointer" style={{ width }} onPointerDown={seekFromEvent} aria-label="Seek" role="slider" aria-valuemin={0} aria-valuemax={Math.round(length)} aria-valuenow={0} tabIndex={-1}>
            {project.loop.on && <div className="absolute inset-y-0 bg-primary/15 border-x border-primary/60" style={{ left: project.loop.start * pps, width: Math.max(2, (project.loop.end - project.loop.start) * pps) }} />}
            {Array.from({ length: bars }, (_, index) => index).filter((index) => index % barStep === 0).map((index) => (
              <span key={index} className="absolute top-0 h-full border-l border-foreground/15 pl-1 pt-1.5 font-mono text-[10px] text-foreground/45" style={{ left: index * bar * pps }}>{index + 1}</span>
            ))}
          </div>
        </div>
        {props.project.tracks.map((track) => (
          <TrackRow key={track.id} {...props} track={track} width={width} bar={bar} header={HEADER} />
        ))}
        {props.project.tracks.length === 0 && <p className="p-6 text-sm text-foreground/50">No tracks yet. Import an instrumental or add a vocal track.</p>}
        {/* Playhead, moved by the Studio every frame without re-rendering. */}
        <div ref={props.playheadRef} className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-primary shadow-[0_0_8px_#A3E635]" style={{ left: HEADER }} />
      </div>
    </div>
  )
}

function TrackRow({ track, width, bar, header, ...props }: TimelineProps & { track: Track; width: number; bar: number; header: number }) {
  const selected = props.selectedTrackId === track.id
  const vocal = track.kind === 'vocal'
  return (
    <div className={`flex border-b border-foreground/10 ${selected ? 'bg-primary/[0.04]' : ''}`} style={{ height: LANE }}>
      <div className={`sticky left-0 z-20 flex shrink-0 flex-col justify-between gap-1 border-r border-foreground/10 bg-surface px-3 py-2 ${selected ? 'shadow-[inset_3px_0_0_#A3E635]' : ''}`} style={{ width: header }} onClick={() => props.onSelectTrack(track.id)}>
        <div className="flex items-center gap-1.5">
          <input value={track.name} onChange={(event) => props.onTrack(track.id, { name: event.target.value })} onKeyDown={(event) => event.stopPropagation()} aria-label="Track name" className="min-w-0 flex-1 truncate bg-transparent text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          <button type="button" aria-label={`Remove ${track.name}`} onClick={(event) => { event.stopPropagation(); props.onRemoveTrack(track.id) }} className="grid h-6 w-6 place-items-center rounded-full text-xs text-foreground/35 hover:bg-red-500/20 hover:text-red-200">✕</button>
        </div>
        <div className="flex items-center gap-1">
          {vocal && <SmallToggle on={track.armed} label="●" title="Arm for recording" activeClass="border-red-500 bg-red-500 text-white" onClick={() => props.onTrack(track.id, { armed: !track.armed })} name={`Arm ${track.name}`} />}
          {vocal && <SmallToggle on={track.monitor} label="🎧" title="Hear yourself through the effects (use headphones)" activeClass="border-secondary bg-secondary text-background" onClick={() => props.onTrack(track.id, { monitor: !track.monitor, armed: true })} name={`Monitor ${track.name}`} />}
          <SmallToggle on={track.mute} label="M" title="Mute" activeClass="border-yellow-400 bg-yellow-400 text-background" onClick={() => props.onTrack(track.id, { mute: !track.mute })} name={`Mute ${track.name}`} />
          <SmallToggle on={track.solo} label="S" title="Solo" activeClass="border-primary bg-primary text-background" onClick={() => props.onTrack(track.id, { solo: !track.solo })} name={`Solo ${track.name}`} />
          <input type="range" min={-40} max={6} step={0.5} value={track.volume} onChange={(event) => props.onTrack(track.id, { volume: Number(event.target.value) })} aria-label={`${track.name} volume`} title={`Volume ${track.volume.toFixed(1)} dB`} className="ml-1 w-10 accent-primary sm:w-16" />
          <input type="range" min={-1} max={1} step={0.05} value={track.pan} onChange={(event) => props.onTrack(track.id, { pan: Number(event.target.value) })} onDoubleClick={() => props.onTrack(track.id, { pan: 0 })} aria-label={`${track.name} pan`} title={`Pan ${track.pan === 0 ? 'center' : track.pan < 0 ? `${Math.round(-track.pan * 100)} L` : `${Math.round(track.pan * 100)} R`}`} className="hidden w-12 accent-secondary sm:block" />
        </div>
      </div>
      <div className="relative" style={{ width, backgroundImage: `repeating-linear-gradient(to right, rgba(229,247,231,0.06) 0 1px, transparent 1px ${bar * props.pixelsPerSecond}px)` }} onPointerDown={(event) => { if (event.target === event.currentTarget) { props.onSelectTrack(track.id); const rect = event.currentTarget.getBoundingClientRect(); props.onSeek(Math.max(0, (event.clientX - rect.left) / props.pixelsPerSecond)) } }}>
        {track.clips.map((clip) => <ClipView key={clip.id} clip={clip} track={track} {...props} />)}
      </div>
    </div>
  )
}

function ClipView({ clip, track, ...props }: TimelineProps & { clip: Clip; track: Track }) {
  const take = activeTake(clip)
  const pps = props.pixelsPerSecond
  const length = Math.max(0.05, take.duration - clip.offset)
  const drag = useRef<{ x: number; start: number; moved: boolean }>(undefined)
  const selected = props.selectedClipId === clip.id
  const vocal = track.kind === 'vocal'
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${track.name} clip at ${clip.start.toFixed(1)} seconds, ${clip.takes.length} take${clip.takes.length > 1 ? 's' : ''}`}
      aria-pressed={selected}
      className={`absolute bottom-1.5 top-1.5 cursor-grab touch-none overflow-hidden rounded-lg border active:cursor-grabbing ${vocal ? 'border-primary/50 bg-primary/15' : 'border-sky-300/40 bg-sky-300/10'} ${selected ? 'ring-2 ring-primary' : ''}`}
      style={{ left: clip.start * pps, width: length * pps }}
      onPointerDown={(event) => {
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { x: event.clientX, start: clip.start, moved: false }
        props.onSelectClip(track.id, clip.id)
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        const delta = (event.clientX - drag.current.x) / pps
        if (Math.abs(event.clientX - drag.current.x) < 4 && !drag.current.moved) return
        drag.current.moved = true
        props.onMoveClip(track.id, clip.id, snapToBeat(drag.current.start + delta, props.project.bpm, !event.shiftKey))
      }}
      onPointerUp={() => { drag.current = undefined }}
      onKeyDown={(event) => {
        const beat = 60 / props.project.bpm
        if (event.key === 'ArrowLeft') { event.preventDefault(); event.stopPropagation(); props.onMoveClip(track.id, clip.id, clip.start - beat) }
        if (event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); props.onMoveClip(track.id, clip.id, clip.start + beat) }
      }}
    >
      <span className="absolute left-1.5 top-0.5 z-10 truncate text-[10px] font-bold text-foreground/80">{take.name}{clip.takes.length > 1 ? ` · ${clip.takes.length} takes` : ''}</span>
      <Waveform buffer={props.buffers.get(take.audioId)} from={clip.offset} to={take.duration} width={length * pps} height={LANE - 14} color={vocal ? '#A3E635' : '#7DD3FC'} />
    </div>
  )
}

function SmallToggle({ on, label, title, activeClass, onClick, name }: { on: boolean; label: string; title: string; activeClass: string; onClick: () => void; name: string }) {
  return (
    <button type="button" aria-pressed={on} aria-label={name} title={title} onClick={(event) => { event.stopPropagation(); onClick() }} className={`grid h-6 min-w-6 place-items-center rounded-md border px-1 text-[10px] font-black ${on ? activeClass : 'border-foreground/15 text-foreground/55 hover:border-foreground/40'}`}>
      {label}
    </button>
  )
}

