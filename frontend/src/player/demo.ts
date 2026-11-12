import { encodeWav } from './wav'

/**
 * Renders a short drum & bass loop offline (kick, snare, hats, a detuned Reese bass and a pad),
 * so the visualizers have something heavy to chew on before the person loads their own songs.
 * Everything is synthesized here, so there's no sample licence to worry about.
 */
export async function renderDemoTrack(): Promise<Blob> {
  const bpm = 172
  const bars = 8
  const sampleRate = 44100
  const beat = 60 / bpm
  const sixteenth = beat / 4
  const seconds = bars * 4 * beat + 1
  const context = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate)

  const master = context.createDynamicsCompressor()
  master.threshold.value = -14
  master.ratio.value = 4
  master.connect(context.destination)

  const noise = context.createBuffer(1, sampleRate, sampleRate)
  const noiseData = noise.getChannelData(0)
  for (let index = 0; index < noiseData.length; index += 1) noiseData[index] = Math.random() * 2 - 1

  const kick = (time: number) => {
    const osc = context.createOscillator()
    const gain = context.createGain()
    osc.frequency.setValueAtTime(160, time)
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.12)
    gain.gain.setValueAtTime(1, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35)
    osc.connect(gain).connect(master)
    osc.start(time)
    osc.stop(time + 0.4)
  }

  const snare = (time: number, level = 0.7) => {
    const source = context.createBufferSource()
    source.buffer = noise
    const filter = context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1800
    const gain = context.createGain()
    gain.gain.setValueAtTime(level, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2)
    source.connect(filter).connect(gain).connect(master)
    source.start(time)
    source.stop(time + 0.25)
    const body = context.createOscillator()
    const bodyGain = context.createGain()
    body.frequency.setValueAtTime(220, time)
    body.frequency.exponentialRampToValueAtTime(140, time + 0.08)
    bodyGain.gain.setValueAtTime(level * 0.6, time)
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12)
    body.connect(bodyGain).connect(master)
    body.start(time)
    body.stop(time + 0.15)
  }

  const hat = (time: number, open = false) => {
    const source = context.createBufferSource()
    source.buffer = noise
    const filter = context.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 8000
    const gain = context.createGain()
    gain.gain.setValueAtTime(open ? 0.22 : 0.14, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + (open ? 0.25 : 0.05))
    source.connect(filter).connect(gain).connect(master)
    source.start(time, Math.random() * 0.5)
    source.stop(time + 0.3)
  }

  const reese = (time: number, duration: number, hz: number) => {
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 6
    filter.frequency.setValueAtTime(260, time)
    filter.frequency.linearRampToValueAtTime(900, time + duration * 0.5)
    filter.frequency.linearRampToValueAtTime(300, time + duration)
    const gain = context.createGain()
    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(0.28, time + 0.02)
    gain.gain.setValueAtTime(0.28, time + duration - 0.03)
    gain.gain.linearRampToValueAtTime(0, time + duration)
    filter.connect(gain).connect(master)
    for (const detune of [-14, 14]) {
      const osc = context.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = hz
      osc.detune.value = detune
      osc.connect(filter)
      osc.start(time)
      osc.stop(time + duration)
    }
  }

  const pad = (time: number, duration: number, notes: number[]) => {
    const gain = context.createGain()
    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(0.05, time + 0.4)
    gain.gain.linearRampToValueAtTime(0, time + duration)
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 2400
    filter.connect(gain).connect(master)
    for (const hz of notes) {
      const osc = context.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = hz
      osc.connect(filter)
      osc.start(time)
      osc.stop(time + duration)
    }
  }

  // Two-step: kick on 1 and the "and" of 3, snare on 2 and 4.
  const kicks = [0, 10]
  const snares = [4, 12]
  const bassNotes = [41.2, 41.2, 49, 36.7] // E1, E1, G1, D1
  const chords = [[164.8, 196, 246.9], [164.8, 196, 246.9], [196, 246.9, 293.7], [146.8, 185, 220]]
  const hasDrums = (bar: number) => bar >= 1

  for (let bar = 0; bar < bars; bar += 1) {
    const barStart = bar * 4 * beat
    pad(barStart, 4 * beat, chords[bar % 4])
    if (bar >= 2) reese(barStart, 4 * beat - 0.02, bassNotes[bar % 4])
    if (!hasDrums(bar)) continue
    for (let step = 0; step < 16; step += 1) {
      const time = barStart + step * sixteenth
      if (kicks.includes(step)) kick(time)
      if (snares.includes(step)) snare(time)
      if (step % 2 === 0) hat(time, step === 14)
      if (bar % 4 === 3 && step >= 12) snare(time, 0.35 + (step - 12) * 0.1)
    }
  }

  const rendered = await context.startRendering()
  return encodeWav(rendered)
}
