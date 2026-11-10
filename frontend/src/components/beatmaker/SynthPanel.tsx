import { allPatches, type SynthPatch, type SynthWave } from '../../beatmaker/genres'
import type { SynthPart } from '../../beatmaker/engine/types'
import { Slider } from './Slider'

const WAVES: { value: SynthWave; label: string }[] = [
  { value: 'sawtooth', label: 'Saw (buzzy)' },
  { value: 'fatsawtooth', label: 'Fat saw (huge)' },
  { value: 'square', label: 'Square (hollow)' },
  { value: 'fatsquare', label: 'Fat square' },
  { value: 'triangle', label: 'Triangle (soft)' },
  { value: 'fattriangle', label: 'Fat triangle' },
  { value: 'sine', label: 'Sine (pure / sub)' },
]

const PART_LABELS: Record<SynthPart, string> = { lead: 'Synth (your melody)', chords: 'Chords', bass: 'Bass' }

interface SynthPanelProps {
  part: SynthPart
  patches: Record<SynthPart, SynthPatch>
  onPart: (part: SynthPart) => void
  onChange: (part: SynthPart, patch: SynthPatch) => void
}

const seconds = (value: number) => (value < 1 ? `${Math.round(value * 1000)} ms` : `${value.toFixed(1)} s`)
const percent = (value: number) => `${Math.round(value * 100)}%`

export function SynthPanel({ part, patches, onPart, onChange }: SynthPanelProps) {
  const current = patches[part]
  const presets = allPatches()
  const set = (changes: Partial<SynthPatch>) => onChange(part, { ...current, ...changes })
  // Cutoff uses a logarithmic slider so the musical range gets most of the travel.
  const cutoffPosition = Math.log2(current.cutoff / 80) / Math.log2(16000 / 80)
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sound to edit">
        {(Object.keys(PART_LABELS) as SynthPart[]).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={key === part} onClick={() => onPart(key)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${key === part ? 'bg-primary text-background' : 'bg-foreground/5 text-foreground/60 hover:text-foreground'}`}>
            {PART_LABELS[key]}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/55">
          Preset
          <select
            className="mt-1 w-full rounded-xl border border-foreground/10 bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
            value={presets.some((preset) => preset.name === current.name) ? current.name : ''}
            onChange={(event) => {
              const preset = presets.find((candidate) => candidate.name === event.target.value)
              if (preset) onChange(part, preset)
            }}
          >
            {!presets.some((preset) => preset.name === current.name) && <option value="">{current.name}</option>}
            {presets.map((preset) => <option key={preset.name} value={preset.name}>{preset.name}</option>)}
          </select>
        </label>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/55">
          Waveform
          <select className="mt-1 w-full rounded-xl border border-foreground/10 bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground" value={current.wave} onChange={(event) => set({ wave: event.target.value as SynthWave, name: `${current.name.replace(/ \(edited\)$/, '')} (edited)` })}>
            {WAVES.map((wave) => <option key={wave.value} value={wave.value}>{wave.label}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 md:grid-cols-4">
        {(() => {
          const edit = (changes: Partial<SynthPatch>) => set({ ...changes, name: `${current.name.replace(/ \(edited\)$/, '')} (edited)` })
          return (
            <>
              <Slider label="Brightness" hint="Filter cutoff" value={cutoffPosition} min={0} max={1} display={`${Math.round(current.cutoff)} Hz`} onChange={(value) => edit({ cutoff: 80 * 2 ** (value * Math.log2(16000 / 80)) })} />
              <Slider label="Resonance" hint="Filter peak, makes it squelchy" value={current.resonance} min={0.5} max={15} step={0.1} display={current.resonance.toFixed(1)} onChange={(value) => edit({ resonance: value })} />
              <Slider label="Pluck" hint="How far the filter opens at the start of each note" value={current.filterEnv} min={0} max={5} step={0.1} display={current.filterEnv.toFixed(1)} onChange={(value) => edit({ filterEnv: value })} />
              <Slider label="Pluck speed" value={current.filterDecay} min={0.02} max={1.5} display={seconds(current.filterDecay)} onChange={(value) => edit({ filterDecay: value })} />
              <Slider label="Fade in" hint="Attack" value={current.attack} min={0.001} max={2} step={0.001} display={seconds(current.attack)} onChange={(value) => edit({ attack: value })} />
              <Slider label="Decay" value={current.decay} min={0.02} max={2} display={seconds(current.decay)} onChange={(value) => edit({ decay: value })} />
              <Slider label="Sustain" hint="Level while a key is held" value={current.sustain} min={0} max={1} display={percent(current.sustain)} onChange={(value) => edit({ sustain: value })} />
              <Slider label="Release" hint="Tail after letting go" value={current.release} min={0.02} max={3} display={seconds(current.release)} onChange={(value) => edit({ release: value })} />
              <Slider label="Drive" hint="Distortion: 0 clean, high is metal" value={current.drive} min={0} max={1} display={percent(current.drive)} onChange={(value) => edit({ drive: value })} />
              <Slider label="Chorus" hint="Shimmer and width (post punk!)" value={current.chorus} min={0} max={1} display={percent(current.chorus)} onChange={(value) => edit({ chorus: value })} />
              <Slider label="Echo" hint="Delay" value={current.delay} min={0} max={1} display={percent(current.delay)} onChange={(value) => edit({ delay: value })} />
              <Slider label="Space" hint="Reverb" value={current.reverb} min={0} max={1} display={percent(current.reverb)} onChange={(value) => edit({ reverb: value })} />
              <Slider label="Thickness" hint="Detune between stacked oscillators (fat waves only)" value={current.spread} min={0} max={60} step={1} display={`${current.spread}¢`} onChange={(value) => edit({ spread: value })} />
              <Slider label="Glide" hint="Slide between notes" value={current.glide} min={0} max={0.3} step={0.005} display={seconds(current.glide)} onChange={(value) => edit({ glide: value })} />
              <Slider label="Octave" value={current.octave} min={-2} max={2} step={1} display={current.octave > 0 ? `+${current.octave}` : String(current.octave)} onChange={(value) => edit({ octave: value })} />
              <Slider label="Volume" value={current.volume} min={-30} max={0} step={0.5} display={`${current.volume.toFixed(1)} dB`} onChange={(value) => edit({ volume: value })} />
            </>
          )
        })()}
      </div>
    </div>
  )
}
