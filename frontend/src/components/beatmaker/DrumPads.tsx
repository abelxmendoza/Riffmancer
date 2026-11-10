import { DRUM_LABELS, type DrumVoice } from '../../beatmaker/genres'
import { COMPUTER_DRUM_KEYS } from '../../beatmaker/input/keymap'

const PADS = Object.entries(COMPUTER_DRUM_KEYS) as [string, DrumVoice][]

export function DrumPads({ active, onHit }: { active: Set<DrumVoice>; onHit: (voice: DrumVoice) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {PADS.map(([key, voice]) => (
        <button
          key={voice}
          type="button"
          onPointerDown={(event) => { event.preventDefault(); onHit(voice) }}
          className={`aspect-[4/3] rounded-2xl border text-left transition select-none ${active.has(voice) ? 'border-primary bg-primary text-background' : 'border-foreground/10 bg-background/50 text-foreground hover:border-secondary'}`}
        >
          <span className="block px-3 text-xs font-black uppercase">{DRUM_LABELS[voice]}</span>
          <span className="block px-3 font-mono text-[10px] opacity-50">key {key}</span>
        </button>
      ))}
    </div>
  )
}
