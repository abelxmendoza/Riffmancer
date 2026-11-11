import * as Tone from 'tone'
import audioBufferToWav from 'audiobuffer-to-wav'
import { zipSync } from 'fflate'
import { activeTake, audibleTrackIds, projectDuration, type StudioProject } from '../project'
import { MasterBus } from './chain'
import { TrackGraph } from './StudioEngine'

/** Seconds added after the last clip so reverb and delay tails ring out. */
const TAIL = 3

export interface RenderOptions {
  /** Only these tracks (still respecting mute/solo when omitted). */
  trackIds?: string[]
  /** Run the master bus (glue, EQ, limiter). Off for stems so they stay mixable. */
  master: boolean
}

/** Renders the project faster than real time with an OfflineAudioContext. Same chains as live playback. */
export async function renderProject(project: StudioProject, buffers: Map<string, Tone.ToneAudioBuffer>, options: RenderOptions): Promise<AudioBuffer> {
  const duration = projectDuration(project) + TAIL
  if (duration <= TAIL) throw new Error('Nothing to export yet. Import an instrumental or record a take first.')
  const include = options.trackIds ? new Set(options.trackIds) : audibleTrackIds(project)
  const rendered = await Tone.Offline(async () => {
    const master = options.master ? new MasterBus(project.master, project.masterVolume) : undefined
    const destination = master ? master.input : Tone.getDestination()
    master?.output.toDestination()
    const waits: Promise<void>[] = []
    for (const track of project.tracks) {
      if (!include.has(track.id)) continue
      const graph = new TrackGraph(track, project.bpm, destination)
      graph.update(track, project.bpm, true)
      if (graph.chain) waits.push(graph.chain.ready)
      for (const clip of track.clips) {
        const buffer = buffers.get(activeTake(clip).audioId)
        if (!buffer) continue
        new Tone.Player(buffer).connect(graph.input).start(clip.start, clip.offset)
      }
    }
    await Promise.all(waits)
  }, duration, 2)
  const buffer = rendered.get()
  if (!buffer) throw new Error('The export came back empty.')
  return buffer
}

export function wavBlob(buffer: AudioBuffer, float = false): Blob {
  return new Blob([audioBufferToWav(buffer, { float32: float })], { type: 'audio/wav' })
}

export function safeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'riffmancer'
}

/** Full mix through the master bus as a 16-bit WAV. */
export async function exportMix(project: StudioProject, buffers: Map<string, Tone.ToneAudioBuffer>): Promise<{ blob: Blob; name: string }> {
  const buffer = await renderProject(project, buffers, { master: true })
  return { blob: wavBlob(buffer), name: `${safeName(project.name)}-mix.wav` }
}

/**
 * Every track rendered on its own with its effects (32-bit float WAVs, no master bus) plus an
 * all-vocals "acapella" stem, zipped together.
 */
export async function exportStems(project: StudioProject, buffers: Map<string, Tone.ToneAudioBuffer>, onProgress?: (done: number, total: number) => void): Promise<{ blob: Blob; name: string }> {
  const tracks = project.tracks.filter((track) => track.clips.length)
  const vocals = tracks.filter((track) => track.kind === 'vocal')
  const total = tracks.length + (vocals.length > 1 ? 1 : 0)
  const files: Record<string, Uint8Array> = {}
  let done = 0
  for (const [index, track] of tracks.entries()) {
    const buffer = await renderProject(project, buffers, { trackIds: [track.id], master: false })
    files[`${String(index + 1).padStart(2, '0')}-${safeName(track.name)}.wav`] = new Uint8Array(audioBufferToWav(buffer, { float32: true }))
    onProgress?.(++done, total)
  }
  if (vocals.length > 1) {
    const buffer = await renderProject(project, buffers, { trackIds: vocals.map((track) => track.id), master: false })
    files['00-all-vocals.wav'] = new Uint8Array(audioBufferToWav(buffer, { float32: true }))
    onProgress?.(++done, total)
  }
  const zipped = zipSync(files, { level: 0 })
  return { blob: new Blob([zipped as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), name: `${safeName(project.name)}-stems.zip` }
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
