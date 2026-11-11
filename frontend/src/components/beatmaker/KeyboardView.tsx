import { chordDegreeForNote, drumForNote, type KeyboardMode } from '../../beatmaker/input/keymap'
import { DRUM_LABELS } from '../../beatmaker/genres'
import { inScale, noteName, type ScaleName } from '../../beatmaker/theory'

const BLACK = new Set([1, 3, 6, 8, 10])
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

interface KeyboardViewProps {
  low: number
  high: number
  mode: KeyboardMode
  splitNote: number
  root: number
  scale: ScaleName
  scaleLock: boolean
  active: Set<number>
  onPress: (note: number) => void
  onRelease: (note: number) => void
}

/** On-screen keyboard that mirrors what each key does and lights up while you play. */
export function KeyboardView({ low, high, mode, splitNote, root, scale, scaleLock, active, onPress, onRelease }: KeyboardViewProps) {
  const notes = Array.from({ length: high - low + 1 }, (_, index) => low + index)
  const whites = notes.filter((note) => !BLACK.has(note % 12))
  const whiteWidth = 100 / whites.length
  const zone = (note: number) => (mode === 'drums' ? 'drums' : mode === 'band' && note < splitNote ? 'chords' : 'synth')

  const label = (note: number) => {
    const kind = zone(note)
    if (kind === 'drums') return DRUM_LABELS[drumForNote(note)].split(' ')[0]
    if (kind === 'chords') return note % 12 === 0 || !BLACK.has(note % 12) ? ROMAN[chordDegreeForNote(note) - 1] : ''
    return note % 12 === 0 ? noteName(note) : ''
  }

  const pointer = (note: number) => ({
    onPointerDown: (event: React.PointerEvent) => { event.preventDefault(); (event.target as Element).setPointerCapture?.(event.pointerId); onPress(note) },
    onPointerUp: () => onRelease(note),
    onPointerCancel: () => onRelease(note),
  })

  return (
    <div className="overflow-x-auto">
      <div className="relative h-36 min-w-[640px] select-none touch-none">
        {whites.map((note, index) => {
          const kind = zone(note)
          const dim = kind === 'synth' && scaleLock && !inScale(note, root, scale)
          const on = active.has(note)
          return (
            <button
              key={note}
              type="button"
              aria-label={`${noteName(note)} ${kind}`}
              {...pointer(note)}
              className={`absolute bottom-0 top-0 flex items-end justify-center rounded-b-lg border border-background pb-2 text-[10px] font-bold transition ${on ? 'bg-primary text-background' : kind === 'chords' ? 'bg-[#cfe9c6] text-background/70' : kind === 'drums' ? 'bg-[#d8e4dc] text-background/70' : dim ? 'bg-foreground/55 text-background/40' : 'bg-foreground text-background/60'}`}
              style={{ left: `${index * whiteWidth}%`, width: `${whiteWidth}%` }}
            >
              {label(note)}
            </button>
          )
        })}
        {notes.filter((note) => BLACK.has(note % 12)).map((note) => {
          const whitesBefore = whites.filter((white) => white < note).length
          const on = active.has(note)
          return (
            <button
              key={note}
              type="button"
              aria-label={`${noteName(note)} ${zone(note)}`}
              {...pointer(note)}
              className={`absolute top-0 z-10 h-[60%] rounded-b-md border border-background transition ${on ? 'bg-primary' : zone(note) === 'chords' ? 'bg-[#2c4a33]' : 'bg-background'}`}
              style={{ left: `${whitesBefore * whiteWidth - whiteWidth * 0.3}%`, width: `${whiteWidth * 0.6}%` }}
            />
          )
        })}
        {mode === 'band' && splitNote > low && splitNote <= high && (
          <div className="pointer-events-none absolute -top-5 text-[10px] font-bold uppercase tracking-wider text-primary" style={{ left: `${whites.filter((white) => white < splitNote).length * whiteWidth}%` }}>
            ▾ synth
          </div>
        )}
      </div>
    </div>
  )
}
