/** Time math for the Studio. No audio code, so it can be unit-tested. */

export const secondsPerBeat = (bpm: number) => 60 / bpm
export const secondsPerBar = (bpm: number, beatsPerBar = 4) => secondsPerBeat(bpm) * beatsPerBar

export function snapToBeat(seconds: number, bpm: number, enabled = true): number {
  if (!enabled) return Math.max(0, seconds)
  const beat = secondsPerBeat(bpm)
  return Math.max(0, Math.round(seconds / beat) * beat)
}

/** "Bar.Beat" label (both 1-based) for a time. */
export function barBeat(seconds: number, bpm: number, beatsPerBar = 4): string {
  const beats = Math.floor(seconds / secondsPerBeat(bpm) + 1e-6)
  return `${Math.floor(beats / beatsPerBar) + 1}.${(beats % beatsPerBar) + 1}`
}

export function clock(seconds: number): string {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const rest = safe - minutes * 60
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`
}

/**
 * Which recorded samples belong to the take.
 *
 * The capture starts at `captureStartTime` (audio-clock seconds) and the song reaches the record
 * point at `songStartTime`. What you sing reaches the computer late by the round-trip latency
 * (you hear the song late, and the mic signal arrives late), so the take starts that much later
 * in the capture.
 */
export function takeStartSample(captureStartTime: number, songStartTime: number, latencyMs: number, sampleRate: number): number {
  return Math.max(0, Math.round((songStartTime - captureStartTime + latencyMs / 1000) * sampleRate))
}

/**
 * Splits a loop (cycle) recording into one take per pass. A last pass shorter than half a loop
 * is dropped as the moment you hit stop; a single short recording is kept.
 */
export function splitPasses(totalSamples: number, loopSamples: number): [number, number][] {
  if (loopSamples <= 0 || totalSamples <= loopSamples) return totalSamples > 0 ? [[0, totalSamples]] : []
  const passes: [number, number][] = []
  for (let start = 0; start < totalSamples; start += loopSamples) {
    const end = Math.min(totalSamples, start + loopSamples)
    if (end - start < loopSamples / 2 && passes.length) break
    passes.push([start, end])
  }
  return passes
}

/** Min/max pairs for drawing a waveform with `buckets` columns. */
export function computePeaks(samples: Float32Array, buckets: number): Float32Array {
  const peaks = new Float32Array(Math.max(0, buckets) * 2)
  if (!samples.length || buckets <= 0) return peaks
  const size = samples.length / buckets
  for (let bucket = 0; bucket < buckets; bucket++) {
    const from = Math.floor(bucket * size)
    const to = Math.max(from + 1, Math.floor((bucket + 1) * size))
    let min = 0
    let max = 0
    for (let index = from; index < to && index < samples.length; index++) {
      const value = samples[index]
      if (value < min) min = value
      if (value > max) max = value
    }
    peaks[bucket * 2] = min
    peaks[bucket * 2 + 1] = max
  }
  return peaks
}

/** Peak level of some samples in dBFS (-Infinity for silence). */
export function peakDb(samples: Float32Array): number {
  let peak = 0
  for (let index = 0; index < samples.length; index++) peak = Math.max(peak, Math.abs(samples[index]))
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity
}

/** Default latency guess from what the browser reports, in ms. Users fine-tune it with the slider. */
export function estimateLatencyMs(baseLatency = 0, outputLatency = 0): number {
  // Input latency isn't reported; on most systems it's close to the output latency.
  const estimate = (baseLatency + outputLatency * 2) * 1000
  return Math.round(Math.min(400, Math.max(0, estimate)))
}
