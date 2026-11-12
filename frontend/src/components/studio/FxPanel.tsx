import { GENRES } from '../../beatmaker/genres'
import { allVocalPresets, DELAY_LABELS, getVocalPreset, MASTER_PRESETS, VOCAL_PRESETS, type DelayTime, type MasterChain, type VocalChain } from '../../studio/presets'
import type { StudioProject, Track } from '../../studio/project'
import { Panel, Slider, Toggle } from '../beatmaker/Slider'

const genreName = (id: string) => (id === 'mine' ? 'Your presets' : id === 'utility' ? 'Any genre' : GENRES.find((genre) => genre.id === id)?.name ?? id)
const GROUPS = [...GENRES.map((genre) => genre.id), 'utility'].filter((id) => VOCAL_PRESETS.some((preset) => preset.genre === id))

const db = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)} dB`
const pct = (value: number) => `${Math.round(value * 100)}%`
const hz = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)} kHz` : `${Math.round(value)} Hz`)

export function PresetSelect({ value, onChange, label = 'Vocal preset' }: { value: string; onChange: (id: string) => void; label?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/55">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
        {value === 'custom' && <option value="custom">Custom (edited)</option>}
        {[...GROUPS, ...(allVocalPresets().some((preset) => preset.genre === 'mine') ? ['mine'] : [])].map((group) => (
          <optgroup key={group} label={genreName(group)}>
            {allVocalPresets().filter((preset) => preset.genre === group).map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-background/40 p-3">
      <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-secondary">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

/** The selected vocal track's effects chain. */
export function FxPanel({ track, onPreset, onChange }: { track: Track; onPreset: (id: string) => void; onChange: (changes: Partial<VocalChain>) => void }) {
  const chain = track.chain
  if (!chain) {
    return (
      <Panel title={`${track.name} · effects`}>
        <p className="text-sm text-foreground/55">Instrumental tracks play exactly as imported. Use the fader and pan, or the master bus, to fit them with your vocals.</p>
      </Panel>
    )
  }
  const preset = track.presetId === 'custom' ? undefined : getVocalPreset(track.presetId)
  return (
    <Panel title={`${track.name} · vocal chain`}>
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-3">
          <PresetSelect value={track.presetId} onChange={onPreset} />
          {preset && (
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-3 text-sm leading-6">
              <p className="text-foreground/80">{preset.description}</p>
              <p className="mt-2 text-xs text-primary/90"><strong>Tip:</strong> {preset.tip}</p>
            </div>
          )}
          {!preset && <p className="text-xs text-foreground/45">You've tweaked this chain. Pick a preset to start over.</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Group title="Clean up">
            <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold uppercase tracking-wider text-foreground/55">Noise gate</span><Toggle on={chain.gate} label={chain.gate ? 'On' : 'Off'} onClick={() => onChange({ gate: !chain.gate })} title="Silences the mic between phrases" /></div>
            {chain.gate && <Slider label="Gate threshold" value={chain.gateThreshold} min={-80} max={-20} step={1} display={db(chain.gateThreshold)} onChange={(gateThreshold) => onChange({ gateThreshold })} />}
            <Slider label="Low cut" value={chain.lowCut} min={20} max={600} step={5} display={hz(chain.lowCut)} onChange={(lowCut) => onChange({ lowCut })} hint="Removes rumble, plosives and mic-stand thumps" />
            <Slider label="High cut" value={chain.highCut} min={2000} max={20000} step={100} display={chain.highCut >= 20000 ? 'Open' : hz(chain.highCut)} onChange={(highCut) => onChange({ highCut })} hint="Lower it for lo-fi or telephone sounds" />
          </Group>
          <Group title="Tone">
            <Slider label="Body (low)" value={chain.low} min={-12} max={12} step={0.5} display={db(chain.low)} onChange={(low) => onChange({ low })} />
            <Slider label="Presence (mid)" value={chain.mid} min={-12} max={12} step={0.5} display={db(chain.mid)} onChange={(mid) => onChange({ mid })} />
            <Slider label="Mid focus" value={chain.midFreq} min={300} max={5000} step={50} display={hz(chain.midFreq)} onChange={(midFreq) => onChange({ midFreq })} />
            <Slider label="Air (high)" value={chain.high} min={-12} max={12} step={0.5} display={db(chain.high)} onChange={(high) => onChange({ high })} />
          </Group>
          <Group title="Dynamics">
            <Slider label="Compress from" value={chain.compThreshold} min={-50} max={0} step={1} display={db(chain.compThreshold)} onChange={(compThreshold) => onChange({ compThreshold })} hint="Lower = more even, more upfront" />
            <Slider label="Ratio" value={chain.compRatio} min={1} max={20} step={0.5} display={`${chain.compRatio.toFixed(1)}:1`} onChange={(compRatio) => onChange({ compRatio })} />
            <Slider label="De-esser" value={chain.deess} min={0} max={1} display={pct(chain.deess)} onChange={(deess) => onChange({ deess })} hint="Tames harsh S and T sounds" />
          </Group>
          <Group title="Grit">
            <Slider label="Drive" value={chain.drive} min={0} max={1} display={pct(chain.drive)} onChange={(drive) => onChange({ drive, driveMix: chain.driveMix || 0.3 })} />
            <Slider label="Drive blend" value={chain.driveMix} min={0} max={1} display={pct(chain.driveMix)} onChange={(driveMix) => onChange({ driveMix })} />
            <Slider label="Octave down" value={chain.octaveDown} min={0} max={1} display={pct(chain.octaveDown)} onChange={(octaveDown) => onChange({ octaveDown })} hint="Adds weight to screams and growls" />
          </Group>
          <Group title="Width">
            <Slider label="Doubler" value={chain.doubler} min={0} max={1} display={pct(chain.doubler)} onChange={(doubler) => onChange({ doubler })} hint="Fakes a second take panned wide" />
            <Slider label="Chorus" value={chain.chorus} min={0} max={1} display={pct(chain.chorus)} onChange={(chorus) => onChange({ chorus })} />
            <Slider label="Output" value={chain.output} min={-24} max={12} step={0.5} display={db(chain.output)} onChange={(output) => onChange({ output })} />
          </Group>
          <Group title="Space">
            <label className="block">
              <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-foreground/55">Delay <Toggle on={chain.pingPong} label="Ping-pong" onClick={() => onChange({ pingPong: !chain.pingPong })} /></span>
              <select value={chain.delayTime} onChange={(event) => onChange({ delayTime: event.target.value as DelayTime })} className="mt-1 w-full rounded-xl border border-foreground/15 bg-background px-3 py-1.5 text-sm text-foreground" aria-label="Delay time">
                {(Object.keys(DELAY_LABELS) as DelayTime[]).map((time) => <option key={time} value={time}>{DELAY_LABELS[time]}</option>)}
              </select>
            </label>
            <Slider label="Delay mix" value={chain.delayMix} min={0} max={1} display={pct(chain.delayMix)} onChange={(delayMix) => onChange({ delayMix })} />
            <Slider label="Delay repeats" value={chain.delayFeedback} min={0} max={0.85} display={pct(chain.delayFeedback)} onChange={(delayFeedback) => onChange({ delayFeedback })} />
            <Slider label="Reverb mix" value={chain.reverbMix} min={0} max={1} display={pct(chain.reverbMix)} onChange={(reverbMix) => onChange({ reverbMix })} />
            <Slider label="Reverb size" value={chain.reverbDecay} min={0.3} max={8} step={0.1} display={`${chain.reverbDecay.toFixed(1)} s`} onChange={(reverbDecay) => onChange({ reverbDecay })} />
          </Group>
        </div>
      </div>
    </Panel>
  )
}

/** Master bus controls. */
export function MasterPanel({ project, onPreset, onChange, onVolume }: { project: StudioProject; onPreset: (id: string) => void; onChange: (changes: Partial<MasterChain>) => void; onVolume: (db: number) => void }) {
  const master = project.master
  return (
    <Panel title="Master bus">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/55">Master preset</span>
          <select value={project.masterPresetId} onChange={(event) => onPreset(event.target.value)} className="mt-1 w-full rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground" aria-label="Master preset">
            {project.masterPresetId === 'custom' && <option value="custom">Custom (edited)</option>}
            {MASTER_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select>
        </label>
        <Slider label="Glue" value={master.glueThreshold} min={-40} max={0} step={1} display={db(master.glueThreshold)} onChange={(glueThreshold) => onChange({ glueThreshold })} hint="Bus compressor threshold: lower glues the mix together" />
        <Slider label="Low end" value={master.low} min={-6} max={6} step={0.5} display={db(master.low)} onChange={(low) => onChange({ low })} />
        <Slider label="Top end" value={master.high} min={-6} max={6} step={0.5} display={db(master.high)} onChange={(high) => onChange({ high })} />
        <Slider label="Loudness" value={master.drive} min={0} max={12} step={0.5} display={db(master.drive)} onChange={(drive) => onChange({ drive })} hint="Pushes the mix into the limiter" />
        <Slider label="Ceiling" value={master.ceiling} min={-6} max={-0.1} step={0.1} display={`${master.ceiling.toFixed(1)} dBFS`} onChange={(ceiling) => onChange({ ceiling })} />
        <Slider label="Master volume" value={project.masterVolume} min={-24} max={6} step={0.5} display={db(project.masterVolume)} onChange={onVolume} />
      </div>
    </Panel>
  )
}
