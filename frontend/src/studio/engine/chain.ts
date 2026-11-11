import * as Tone from 'tone'
import { delaySeconds, type MasterChain, type VocalChain } from '../presets'

/**
 * A vocal effects chain built from Tone.js (MIT) effects. The same builder runs live and in the
 * offline mixdown, so exports sound like what you heard.
 *
 *   in → gate → low cut → high cut → EQ → compressor → de-esser → drive ─┬─ dry ───────────┬→ chorus → delay → reverb → trim → out
 *                                                                       ├─ octave down ───┤
 *                                                                       └─ doubler L / R ─┘
 */
export class VocalChainNode {
  readonly input = new Tone.Gain(1)
  readonly output = new Tone.Volume(0)
  private readonly gate = new Tone.Gate(-100, 0.05)
  private readonly lowCut = new Tone.Filter({ type: 'highpass', frequency: 90, rolloff: -24 })
  private readonly highCut = new Tone.Filter({ type: 'lowpass', frequency: 20000, rolloff: -12 })
  private readonly eq = new Tone.EQ3({ low: 0, mid: 0, high: 0, lowFrequency: 250, highFrequency: 4000 })
  private readonly midBell = new Tone.Filter({ type: 'peaking', frequency: 1500, Q: 0.9, gain: 0 })
  private readonly comp = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.01, release: 0.15, knee: 6 })
  private readonly deesser = new Tone.MultibandCompressor({ lowFrequency: 200, highFrequency: 5500, low: { ratio: 1, threshold: 0 }, mid: { ratio: 1, threshold: 0 }, high: { ratio: 1, threshold: 0 } })
  private readonly drive = new Tone.Distortion({ distortion: 0, wet: 0, oversample: '2x' })
  private readonly dry = new Tone.Gain(1)
  private readonly octave = new Tone.PitchShift({ pitch: -12, windowSize: 0.08 })
  private readonly octaveGain = new Tone.Gain(0)
  private readonly doubleLeft = new Tone.PitchShift({ pitch: 0.12, windowSize: 0.05, delayTime: 0.018 })
  private readonly doubleRight = new Tone.PitchShift({ pitch: -0.12, windowSize: 0.05, delayTime: 0.027 })
  private readonly doubleLeftPan = new Tone.Panner(-0.85)
  private readonly doubleRightPan = new Tone.Panner(0.85)
  private readonly doubleGain = new Tone.Gain(0)
  private readonly sum = new Tone.Gain(1)
  private readonly chorus = new Tone.Chorus({ frequency: 1.2, delayTime: 3.5, depth: 0.5, wet: 0 }).start()
  private readonly delay = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.2, wet: 0 })
  private readonly pingPong = new Tone.PingPongDelay({ delayTime: 0.25, feedback: 0.2, wet: 0 })
  private readonly reverb = new Tone.Reverb({ decay: 1.6, preDelay: 0.02, wet: 0 })
  private reverbDecay = 1.6
  private reverbPreDelay = 0.02

  constructor(chain: VocalChain, bpm: number) {
    this.input.chain(this.gate, this.lowCut, this.highCut, this.eq, this.midBell, this.comp, this.deesser, this.drive)
    this.drive.connect(this.dry)
    this.drive.chain(this.octave, this.octaveGain)
    this.drive.chain(this.doubleLeft, this.doubleLeftPan, this.doubleGain)
    this.drive.chain(this.doubleRight, this.doubleRightPan, this.doubleGain)
    this.dry.connect(this.sum)
    this.octaveGain.connect(this.sum)
    this.doubleGain.connect(this.sum)
    this.sum.chain(this.chorus, this.delay, this.pingPong, this.reverb, this.output)
    this.update(chain, bpm)
  }

  /** Resolves when the reverb impulse is ready (needed before an offline render). */
  get ready(): Promise<void> {
    return this.reverb.ready
  }

  update(chain: VocalChain, bpm: number) {
    this.gate.threshold = chain.gate ? chain.gateThreshold : -100
    this.lowCut.frequency.value = chain.lowCut
    this.highCut.frequency.value = Math.min(20000, chain.highCut)
    this.eq.low.value = chain.low
    this.eq.high.value = chain.high
    this.midBell.frequency.value = chain.midFreq
    this.midBell.gain.value = chain.mid
    this.comp.threshold.value = chain.compThreshold
    this.comp.ratio.value = chain.compRatio
    this.comp.attack.value = chain.compAttack
    this.comp.release.value = chain.compRelease
    this.deesser.high.threshold.value = -6 - 34 * chain.deess
    this.deesser.high.ratio.value = 1 + 11 * chain.deess
    this.drive.distortion = chain.drive
    this.drive.wet.value = chain.drive > 0 ? chain.driveMix : 0
    this.octaveGain.gain.value = chain.octaveDown * 0.8
    this.doubleGain.gain.value = chain.doubler * 0.7
    this.chorus.wet.value = chain.chorus * 0.7
    const time = delaySeconds(chain.delayTime, bpm)
    const active = chain.pingPong ? this.pingPong : this.delay
    const idle = chain.pingPong ? this.delay : this.pingPong
    active.delayTime.value = time
    active.feedback.value = chain.delayFeedback
    active.wet.value = chain.delayMix
    idle.wet.value = 0
    this.reverb.wet.value = chain.reverbMix
    if (chain.reverbDecay !== this.reverbDecay || chain.reverbPreDelay !== this.reverbPreDelay) {
      this.reverbDecay = chain.reverbDecay
      this.reverbPreDelay = chain.reverbPreDelay
      this.reverb.decay = chain.reverbDecay
      this.reverb.preDelay = chain.reverbPreDelay
    }
    this.output.volume.value = chain.output
  }

  dispose() {
    for (const node of [this.input, this.gate, this.lowCut, this.highCut, this.eq, this.midBell, this.comp, this.deesser, this.drive, this.dry, this.octave, this.octaveGain, this.doubleLeft, this.doubleRight, this.doubleLeftPan, this.doubleRightPan, this.doubleGain, this.sum, this.chorus, this.delay, this.pingPong, this.reverb, this.output]) node.dispose()
  }
}

/** Master bus: glue compressor → tilt EQ → drive → limiter → master fader. */
export class MasterBus {
  readonly input = new Tone.Gain(1)
  readonly output = new Tone.Volume(0)
  private readonly glue = new Tone.Compressor({ threshold: -14, ratio: 2, attack: 0.03, release: 0.25, knee: 10 })
  private readonly tilt = new Tone.EQ3({ low: 0, mid: 0, high: 0, lowFrequency: 180, highFrequency: 6000 })
  private readonly drive = new Tone.Volume(0)
  private readonly limiter = new Tone.Limiter(-1)

  constructor(chain: MasterChain, volume: number) {
    this.input.chain(this.glue, this.tilt, this.drive, this.limiter, this.output)
    this.update(chain, volume)
  }

  update(chain: MasterChain, volume: number) {
    this.glue.threshold.value = chain.glueThreshold
    this.glue.ratio.value = chain.glueRatio
    this.tilt.low.value = chain.low
    this.tilt.high.value = chain.high
    this.drive.volume.value = chain.drive
    this.limiter.threshold.value = chain.ceiling
    this.output.volume.value = volume
  }

  dispose() {
    for (const node of [this.input, this.glue, this.tilt, this.drive, this.limiter, this.output]) node.dispose()
  }
}
