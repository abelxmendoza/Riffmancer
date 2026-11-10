import * as Tone from 'tone'
import type { DrumVoice, KitPatch } from '../genres'

/** Synthesized drum kit, so no sample files or sample licenses are needed. */
export class DrumKit {
  readonly output = new Tone.Volume(0)
  private readonly bus = new Tone.Compressor({ threshold: -18, ratio: 4, attack: 0.003, release: 0.12 })
  private readonly drive = new Tone.Distortion({ distortion: 0, wet: 0 })
  private readonly room = new Tone.Reverb({ decay: 1.2, wet: 0.15 })
  private readonly kick = new Tone.MembraneSynth()
  private readonly snareBody = new Tone.MembraneSynth({ octaves: 2, pitchDecay: 0.02, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 } })
  private readonly snareNoise = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 } })
  private readonly snareFilter = new Tone.Filter({ type: 'bandpass', frequency: 4000, Q: 0.8 })
  private readonly clap = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.14, sustain: 0 } })
  private readonly clapFilter = new Tone.Filter({ type: 'bandpass', frequency: 1400, Q: 1.5 })
  private readonly rim = new Tone.MembraneSynth({ octaves: 1, pitchDecay: 0.005, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 } })
  private readonly closedHat = new Tone.MetalSynth({ harmonicity: 5.1, modulationIndex: 32, resonance: 5000, octaves: 1.5, envelope: { attack: 0.001, decay: 0.05, release: 0.01 } })
  private readonly openHat = new Tone.MetalSynth({ harmonicity: 5.1, modulationIndex: 32, resonance: 4500, octaves: 1.5, envelope: { attack: 0.001, decay: 0.35, release: 0.1 } })
  private readonly ride = new Tone.MetalSynth({ harmonicity: 3.1, modulationIndex: 16, resonance: 7000, octaves: 1, envelope: { attack: 0.001, decay: 0.9, release: 0.3 } })
  private readonly crash = new Tone.MetalSynth({ harmonicity: 5.1, modulationIndex: 64, resonance: 4000, octaves: 2, envelope: { attack: 0.001, decay: 1.6, release: 0.6 } })
  private readonly tomHigh = new Tone.MembraneSynth({ octaves: 2, pitchDecay: 0.06, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 } })
  private readonly tomLow = new Tone.MembraneSynth({ octaves: 2, pitchDecay: 0.08, envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.1 } })
  private readonly lastTime = new Map<DrumVoice, number>()
  private kitPatch?: KitPatch

  constructor() {
    this.drive.chain(this.room, this.bus, this.output)
    this.kick.connect(this.drive)
    this.snareBody.connect(this.drive)
    this.snareNoise.chain(this.snareFilter, this.drive)
    this.clap.chain(this.clapFilter, this.drive)
    this.rim.connect(this.drive)
    for (const metal of [this.closedHat, this.openHat, this.ride, this.crash]) metal.connect(this.drive)
    this.tomHigh.connect(this.drive)
    this.tomLow.connect(this.drive)
    this.closedHat.volume.value = -14
    this.openHat.volume.value = -16
    this.ride.volume.value = -20
    this.crash.volume.value = -16
    this.clap.volume.value = -4
    this.rim.volume.value = -8
  }

  applyKit(patch: KitPatch) {
    this.kitPatch = patch
    this.kick.set({ octaves: 4 + patch.kickPunch * 3, pitchDecay: 0.03 + (1 - patch.kickPunch) * 0.05, envelope: { attack: 0.001, decay: patch.kickDecay, sustain: 0, release: 0.1 } })
    this.snareNoise.set({ envelope: { decay: patch.snareDecay } })
    this.snareFilter.frequency.value = patch.snareBrightness
    this.snareBody.volume.value = Tone.gainToDb(Math.max(0.05, patch.snareTone))
    this.closedHat.set({ envelope: { decay: patch.hatDecay } })
    this.drive.distortion = patch.drive
    this.drive.wet.value = patch.drive > 0 ? 1 : 0
    this.room.wet.value = patch.room
    this.output.volume.value = patch.volume
  }

  /** Monophonic Tone instruments refuse two starts at the same instant, so nudge repeats forward. */
  private at(voice: DrumVoice, time: number) {
    const previous = this.lastTime.get(voice) ?? 0
    const safe = time <= previous ? previous + 0.002 : time
    this.lastTime.set(voice, safe)
    return safe
  }

  hit(voice: DrumVoice, time: number, velocity: number) {
    const t = this.at(voice, time)
    const v = Math.max(0.05, Math.min(1, velocity))
    switch (voice) {
      case 'kick':
        this.kick.triggerAttackRelease(this.kitPatch?.kickPitch ?? 32, 0.3, t, v)
        break
      case 'snare':
        this.snareBody.triggerAttackRelease(185, 0.1, t, v)
        this.snareNoise.triggerAttackRelease(0.2, t, v)
        break
      case 'clap':
        this.clap.triggerAttackRelease(0.15, t, v)
        break
      case 'rim':
        this.rim.triggerAttackRelease(820, 0.03, t, v)
        break
      case 'closedHat':
        this.openHat.triggerRelease(t)
        this.closedHat.triggerAttackRelease(250, 0.05, t, v)
        break
      case 'openHat':
        this.openHat.triggerAttackRelease(250, 0.4, t, v)
        break
      case 'ride':
        this.ride.triggerAttackRelease(320, 0.8, t, v)
        break
      case 'crash':
        this.crash.triggerAttackRelease(300, 1.5, t, v)
        break
      case 'tomHigh':
        this.tomHigh.triggerAttackRelease(190, 0.3, t, v)
        break
      case 'tomLow':
        this.tomLow.triggerAttackRelease(105, 0.4, t, v)
        break
    }
  }

  dispose() {
    for (const node of [this.output, this.bus, this.drive, this.room, this.kick, this.snareBody, this.snareNoise, this.snareFilter, this.clap, this.clapFilter, this.rim, this.closedHat, this.openHat, this.ride, this.crash, this.tomHigh, this.tomLow]) node.dispose()
  }
}
