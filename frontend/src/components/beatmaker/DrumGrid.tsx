import { DRUM_LABELS, DRUM_VOICES, type DrumVoice } from '../../beatmaker/genres'
import { ACCENT, GHOST, STEPS, type DrumGrid as Grid } from '../../beatmaker/pattern'

interface DrumGridProps {
  grid: Grid
  playStep: number | undefined
  onToggle: (voice: DrumVoice, step: number) => void
  onAudition: (voice: DrumVoice) => void
}

function cellClass(velocity: number, beat: boolean) {
  if (velocity >= ACCENT) return 'bg-primary border-primary'
  if (velocity > GHOST) return 'bg-secondary/80 border-secondary'
  if (velocity > 0) return 'bg-secondary/30 border-secondary/50'
  return beat ? 'bg-foreground/[0.07] border-foreground/10' : 'bg-foreground/[0.03] border-foreground/5'
}

export function DrumGrid({ grid, playStep, onToggle, onAudition }: DrumGridProps) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px] space-y-1.5">
        {DRUM_VOICES.map((voice) => (
          <div key={voice} className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2">
            <button type="button" onClick={() => onAudition(voice)} className="truncate rounded-lg px-2 py-1 text-left text-[11px] font-bold text-foreground/60 hover:bg-foreground/5 hover:text-foreground" title={`Hear the ${DRUM_LABELS[voice]}`}>
              {DRUM_LABELS[voice]}
            </button>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${STEPS}, minmax(0, 1fr))` }}>
              {grid[voice].map((velocity, step) => (
                <button
                  key={step}
                  type="button"
                  aria-label={`${DRUM_LABELS[voice]} step ${step + 1}${velocity ? ' on' : ''}`}
                  onClick={() => onToggle(voice, step)}
                  className={`h-6 rounded-md border transition ${cellClass(velocity, step % 4 === 0)} ${playStep === step ? 'ring-2 ring-foreground/70' : ''}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-foreground/40">Click a square to add a hit. Click again for loud, again for soft, again to clear.</p>
    </div>
  )
}
