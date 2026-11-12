import { useCallback, useEffect, useRef, useState } from 'react'
import type { AudioEngine } from '../../beatmaker/engine/AudioEngine'
import type { MixPart, SynthPart } from '../../beatmaker/engine/types'
import type { DrumVoice } from '../../beatmaker/genres'
import type { SongConductor, SongTick } from '../../song/player'
import type { SongSpec } from '../../song/spec'

export interface Position {
  sectionIndex: number
  barInSection: number
  step: number
}

/** Plays a song through the shared audio engine. Tone.js loads on the first press of play. */
export function useSongPlayer(song: SongSpec | undefined) {
  const songRef = useRef(song)
  songRef.current = song
  const engineRef = useRef<AudioEngine<SongConductor> | undefined>(undefined)
  const enginePromise = useRef<Promise<AudioEngine<SongConductor>> | undefined>(undefined)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string>()
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState<Position>()
  const [loopSection, setLoopSectionState] = useState<number>()
  const loopRef = useRef<number | undefined>(undefined)

  const ensureEngine = useCallback(async () => {
    if (engineRef.current) return engineRef.current
    if (!enginePromise.current) {
      enginePromise.current = (async () => {
        const [{ AudioEngine }, { SongConductor }] = await Promise.all([import('../../beatmaker/engine/AudioEngine'), import('../../song/player')])
        const current = songRef.current
        if (!current) throw new Error('No song to play yet.')
        const conductor = new SongConductor(() => songRef.current ?? current)
        conductor.loopSection = loopRef.current
        const engine = await AudioEngine.withTicker(conductor, current.sounds, current.kit, (tick: SongTick) => {
          setPosition({ sectionIndex: tick.sectionIndex, barInSection: tick.barInSection, step: tick.step })
          // The whole song played through: stop at the end instead of looping forever.
          if (tick.wrapped && conductor.loopSection === undefined) {
            engine.stop()
            setPlaying(false)
            setPosition(undefined)
          }
        })
        engineRef.current = engine
        setReady(true)
        return engine
      })().catch((reason: unknown) => {
        enginePromise.current = undefined
        setError(reason instanceof Error ? reason.message : 'Audio could not start in this browser.')
        throw reason
      })
    }
    return enginePromise.current
  }, [])

  useEffect(() => () => { engineRef.current?.dispose() }, [])

  // Keep the engine in step with the song as Fret edits it.
  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !song) return
    engine.setTempo(song.bpm, song.swing)
    engine.applyKit(song.kit)
    for (const part of ['bass', 'chords', 'lead'] as SynthPart[]) engine.applyPatch(part, song.sounds[part])
    for (const [part, level] of Object.entries(song.levels)) engine.setLevel(part as MixPart, level)
  }, [song, ready])

  const play = useCallback(async (sectionIndex = 0) => {
    try {
      const engine = await ensureEngine()
      const current = songRef.current
      if (!current) return
      engine.setTempo(current.bpm, current.swing)
      if (engine.playing) engine.stop()
      engine.conductor.startAt(sectionIndex)
      engine.play()
      setPlaying(true)
    } catch {
      // ensureEngine already reported the error.
    }
  }, [ensureEngine])

  const stop = useCallback(() => {
    engineRef.current?.stop()
    setPlaying(false)
    setPosition(undefined)
  }, [])

  const setLoopSection = useCallback((index: number | undefined) => {
    setLoopSectionState(index)
    loopRef.current = index
    if (engineRef.current) engineRef.current.conductor.loopSection = index
  }, [])

  const audition = useCallback(async (voice: DrumVoice) => {
    try { (await ensureEngine()).hitDrum(voice, 0.9) } catch { /* reported */ }
  }, [ensureEngine])

  return { ready, error, playing, position, loopSection, play, stop, setLoopSection, audition }
}
