import { defaultPresetFor, getMasterPreset, getVocalPreset, MASTER_PRESETS, type MasterChain, type VocalChain, type VocalPreset } from './presets'

/**
 * The Studio's project model. Plain data and pure functions so it can be saved, tested, and
 * driven by Fret. Audio lives elsewhere, referenced by `audioId`.
 */

export interface Take {
  id: string
  /** Key of the audio in local storage. Original audio is never changed after it's stored. */
  audioId: string
  duration: number
  name: string
  createdAt: number
}

export interface Clip {
  id: string
  /** Start position on the timeline in seconds. */
  start: number
  /** Seconds skipped at the start of the take. */
  offset: number
  takes: Take[]
  activeTakeId: string
}

export type TrackKind = 'instrumental' | 'vocal'
export type VocalRole = VocalPreset['role']

export interface Track {
  id: string
  name: string
  kind: TrackKind
  role: VocalRole
  /** Fader in dB. */
  volume: number
  /** -1 (left) to 1 (right). */
  pan: number
  mute: boolean
  solo: boolean
  armed: boolean
  /** Hear yourself through the effects while armed. */
  monitor: boolean
  presetId: string
  /** Effects chain. Instrumental tracks have none (they play as imported). */
  chain: VocalChain | null
  clips: Clip[]
}

export interface LoopRegion {
  on: boolean
  start: number
  end: number
}

export interface StudioProject {
  id: string
  name: string
  genre: string
  bpm: number
  beatsPerBar: number
  tracks: Track[]
  masterPresetId: string
  master: MasterChain
  masterVolume: number
  loop: LoopRegion
  countInBars: number
  metronome: boolean
  /** Recording latency compensation in milliseconds. */
  latencyMs: number
  updatedAt: number
}

export const MAX_TRACKS = 16

export const ROLE_NAMES: Record<VocalRole, string> = {
  lead: 'Lead vocal',
  double: 'Double',
  'ad-lib': 'Ad-libs',
  scream: 'Screams',
  gang: 'Gang vocals',
  harmony: 'Harmony',
  fx: 'Vocal FX',
}

export function newId(prefix = 'id'): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  return `${prefix}-${random}`
}

const GENRE_BPM: Record<string, number> = { 'post-punk': 142, metal: 160, punk: 180, 'drum-and-bass': 174, reggaeton: 95, 'boom-bap': 90, house: 124 }

export function createProject(genre = 'post-punk'): StudioProject {
  const masterPreset = MASTER_PRESETS.find((preset) => preset.genre === genre) ?? MASTER_PRESETS[0]
  const project: StudioProject = {
    id: newId('project'),
    name: 'Untitled session',
    genre,
    bpm: GENRE_BPM[genre] ?? 120,
    beatsPerBar: 4,
    tracks: [],
    masterPresetId: masterPreset.id,
    master: { ...masterPreset.chain },
    masterVolume: 0,
    loop: { on: false, start: 0, end: 8 },
    countInBars: 1,
    metronome: true,
    latencyMs: 0,
    updatedAt: Date.now(),
  }
  return addVocalTrack(project, 'lead')
}

export function addVocalTrack(project: StudioProject, role: VocalRole = 'lead'): StudioProject {
  if (project.tracks.length >= MAX_TRACKS) return project
  const preset = defaultPresetFor(project.genre, role)
  const sameRole = project.tracks.filter((track) => track.kind === 'vocal' && track.role === role).length
  const track: Track = {
    id: newId('track'),
    name: sameRole ? `${ROLE_NAMES[role]} ${sameRole + 1}` : ROLE_NAMES[role],
    kind: 'vocal',
    role,
    volume: role === 'lead' || role === 'scream' ? 0 : -4,
    pan: role === 'double' || role === 'harmony' ? (sameRole % 2 === 0 ? -0.5 : 0.5) : 0,
    mute: false,
    solo: false,
    // The first vocal track is armed so "record" just works.
    armed: !project.tracks.some((existing) => existing.armed),
    monitor: false,
    presetId: preset.id,
    chain: { ...preset.chain },
    clips: [],
  }
  return touch({ ...project, tracks: [...project.tracks, track] })
}

/** Adds an imported instrumental (or a stem) as its own track, placed at the start of the song. */
export function addInstrumentalTrack(project: StudioProject, name: string, audioId: string, duration: number): StudioProject {
  if (project.tracks.length >= MAX_TRACKS) return project
  const take: Take = { id: newId('take'), audioId, duration, name, createdAt: Date.now() }
  const track: Track = {
    id: newId('track'),
    name,
    kind: 'instrumental',
    role: 'lead',
    volume: -3,
    pan: 0,
    mute: false,
    solo: false,
    armed: false,
    monitor: false,
    presetId: 'none',
    chain: null,
    clips: [{ id: newId('clip'), start: 0, offset: 0, takes: [take], activeTakeId: take.id }],
  }
  // Instrumentals sit above the vocals.
  const firstVocal = project.tracks.findIndex((existing) => existing.kind === 'vocal')
  const tracks = [...project.tracks]
  tracks.splice(firstVocal === -1 ? tracks.length : firstVocal, 0, track)
  return touch({ ...project, tracks })
}

export function updateTrack(project: StudioProject, trackId: string, changes: Partial<Track>): StudioProject {
  let tracks = project.tracks.map((track) => (track.id === trackId ? { ...track, ...changes } : track))
  // Only one track records at a time.
  if (changes.armed) tracks = tracks.map((track) => (track.id === trackId ? track : { ...track, armed: false, monitor: false }))
  return touch({ ...project, tracks })
}

export function removeTrack(project: StudioProject, trackId: string): StudioProject {
  return touch({ ...project, tracks: project.tracks.filter((track) => track.id !== trackId) })
}

export function applyPreset(project: StudioProject, trackId: string, presetId: string): StudioProject {
  const preset = getVocalPreset(presetId)
  return updateTrack(project, trackId, { presetId: preset.id, chain: { ...preset.chain } })
}

export function updateChain(project: StudioProject, trackId: string, changes: Partial<VocalChain>): StudioProject {
  const track = project.tracks.find((candidate) => candidate.id === trackId)
  if (!track?.chain) return project
  return updateTrack(project, trackId, { chain: { ...track.chain, ...changes }, presetId: 'custom' })
}

export function applyMasterPreset(project: StudioProject, presetId: string): StudioProject {
  const preset = getMasterPreset(presetId)
  return touch({ ...project, masterPresetId: preset.id, master: { ...preset.chain } })
}

/** Changes the project genre and moves every vocal track that still uses a stock preset to the new genre's preset. */
export function setGenre(project: StudioProject, genre: string): StudioProject {
  const tracks = project.tracks.map((track) => {
    if (track.kind !== 'vocal' || track.presetId === 'custom') return track
    const preset = defaultPresetFor(genre, track.role)
    return { ...track, presetId: preset.id, chain: { ...preset.chain } }
  })
  const master = MASTER_PRESETS.find((preset) => preset.genre === genre)
  return touch({ ...project, genre, tracks, ...(master ? { masterPresetId: master.id, master: { ...master.chain } } : {}) })
}

export function activeTake(clip: Clip): Take {
  return clip.takes.find((take) => take.id === clip.activeTakeId) ?? clip.takes[clip.takes.length - 1]
}

export function clipEnd(clip: Clip): number {
  return clip.start + Math.max(0, activeTake(clip).duration - clip.offset)
}

/**
 * Adds freshly recorded takes to a track. If the recording starts inside an existing clip at the
 * same spot, the takes join that clip as alternatives (newest one active), Ableton/Logic style.
 * Otherwise they form a new clip.
 */
export function addTakes(project: StudioProject, trackId: string, start: number, takes: Take[]): StudioProject {
  if (!takes.length) return project
  const track = project.tracks.find((candidate) => candidate.id === trackId)
  if (!track) return project
  const newest = takes[takes.length - 1]
  const match = track.clips.find((clip) => Math.abs(clip.start - start) < 0.05)
  let clips: Clip[]
  if (match) {
    clips = track.clips.map((clip) => (clip.id === match.id ? { ...clip, offset: 0, takes: [...clip.takes, ...takes], activeTakeId: newest.id } : clip))
  } else {
    clips = [...track.clips, { id: newId('clip'), start, offset: 0, takes, activeTakeId: newest.id }].sort((a, b) => a.start - b.start)
  }
  return updateTrack(project, trackId, { clips })
}

export function setActiveTake(project: StudioProject, trackId: string, clipId: string, takeId: string): StudioProject {
  return mapClip(project, trackId, clipId, (clip) => ({ ...clip, activeTakeId: takeId }))
}

/** Deletes a take. A clip with no takes left is removed. */
export function removeTake(project: StudioProject, trackId: string, clipId: string, takeId: string): StudioProject {
  const track = project.tracks.find((candidate) => candidate.id === trackId)
  if (!track) return project
  const clips = track.clips.flatMap((clip) => {
    if (clip.id !== clipId) return [clip]
    const takes = clip.takes.filter((take) => take.id !== takeId)
    if (!takes.length) return []
    return [{ ...clip, takes, activeTakeId: clip.activeTakeId === takeId ? takes[takes.length - 1].id : clip.activeTakeId }]
  })
  return updateTrack(project, trackId, { clips })
}

export function moveClip(project: StudioProject, trackId: string, clipId: string, start: number): StudioProject {
  return mapClip(project, trackId, clipId, (clip) => ({ ...clip, start: Math.max(0, start) }))
}

export function removeClip(project: StudioProject, trackId: string, clipId: string): StudioProject {
  const track = project.tracks.find((candidate) => candidate.id === trackId)
  if (!track) return project
  return updateTrack(project, trackId, { clips: track.clips.filter((clip) => clip.id !== clipId) })
}

function mapClip(project: StudioProject, trackId: string, clipId: string, change: (clip: Clip) => Clip): StudioProject {
  const track = project.tracks.find((candidate) => candidate.id === trackId)
  if (!track) return project
  return updateTrack(project, trackId, { clips: track.clips.map((clip) => (clip.id === clipId ? change(clip) : clip)) })
}

/** End of the last clip, in seconds. */
export function projectDuration(project: StudioProject): number {
  return project.tracks.reduce((end, track) => track.clips.reduce((trackEnd, clip) => Math.max(trackEnd, clipEnd(clip)), end), 0)
}

/** Tracks you can hear: soloed tracks if any are soloed, otherwise every unmuted track. */
export function audibleTrackIds(project: StudioProject): Set<string> {
  const soloed = project.tracks.filter((track) => track.solo)
  const list = soloed.length ? soloed : project.tracks.filter((track) => !track.mute)
  return new Set(list.map((track) => track.id))
}

/** Every audio id the project uses, so storage can drop the rest. */
export function audioIdsIn(project: StudioProject): Set<string> {
  return new Set(project.tracks.flatMap((track) => track.clips.flatMap((clip) => clip.takes.map((take) => take.audioId))))
}

export function armedTrack(project: StudioProject): Track | undefined {
  return project.tracks.find((track) => track.armed && track.kind === 'vocal')
}

function touch(project: StudioProject): StudioProject {
  return { ...project, updatedAt: Date.now() }
}

/** Fills in anything an older saved project is missing. */
export function migrateProject(raw: unknown): StudioProject | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Partial<StudioProject>
  if (!Array.isArray(value.tracks) || typeof value.id !== 'string') return undefined
  const base = createProject(typeof value.genre === 'string' ? value.genre : 'post-punk')
  return { ...base, ...value, tracks: value.tracks, master: { ...base.master, ...value.master }, loop: { ...base.loop, ...value.loop } }
}
