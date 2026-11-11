import { describe, expect, it } from 'vitest'
import { activeTake, addInstrumentalTrack, addTakes, addVocalTrack, applyPreset, armedTrack, audibleTrackIds, createProject, migrateProject, moveClip, projectDuration, removeTake, setGenre, updateChain, updateTrack, type Take } from './project'

const take = (id: string, duration = 4): Take => ({ id, audioId: `audio-${id}`, duration, name: id, createdAt: 0 })

describe('studio project', () => {
  it('starts with an armed lead vocal using the genre preset', () => {
    const project = createProject('metal')
    expect(project.bpm).toBe(160)
    expect(project.tracks).toHaveLength(1)
    expect(project.tracks[0]).toMatchObject({ kind: 'vocal', role: 'lead', armed: true, presetId: 'metal-clean' })
    expect(project.masterPresetId).toBe('master-metal')
  })

  it('puts instrumentals above vocals and pans doubles apart', () => {
    let project = addInstrumentalTrack(createProject('punk'), 'Suno beat', 'a1', 120)
    project = addVocalTrack(addVocalTrack(project, 'double'), 'double')
    expect(project.tracks.map((track) => track.kind)).toEqual(['instrumental', 'vocal', 'vocal', 'vocal'])
    const doubles = project.tracks.filter((track) => track.role === 'double')
    expect(doubles.map((track) => track.pan)).toEqual([-0.5, 0.5])
    expect(doubles[1].name).toBe('Double 2')
    expect(projectDuration(project)).toBe(120)
  })

  it('arms one track at a time', () => {
    let project = addVocalTrack(createProject(), 'ad-lib')
    project = updateTrack(project, project.tracks[1].id, { armed: true })
    expect(project.tracks.map((track) => track.armed)).toEqual([false, true])
    expect(armedTrack(project)?.role).toBe('ad-lib')
  })

  it('stacks takes recorded at the same spot and keeps the newest active', () => {
    let project = createProject()
    const trackId = project.tracks[0].id
    project = addTakes(project, trackId, 2, [take('t1')])
    project = addTakes(project, trackId, 2, [take('t2'), take('t3', 6)])
    project = addTakes(project, trackId, 10, [take('t4')])
    const clips = project.tracks[0].clips
    expect(clips).toHaveLength(2)
    expect(clips[0].takes.map((item) => item.id)).toEqual(['t1', 't2', 't3'])
    expect(activeTake(clips[0]).id).toBe('t3')
    expect(projectDuration(project)).toBe(14)

    project = removeTake(project, trackId, clips[0].id, 't3')
    expect(activeTake(project.tracks[0].clips[0]).id).toBe('t2')
    project = moveClip(project, trackId, clips[0].id, -5)
    expect(project.tracks[0].clips[0].start).toBe(0)
  })

  it('handles solo and mute', () => {
    let project = addVocalTrack(createProject(), 'double')
    const [lead, double] = project.tracks
    project = updateTrack(project, double.id, { mute: true })
    expect([...audibleTrackIds(project)]).toEqual([lead.id])
    project = updateTrack(project, double.id, { solo: true })
    expect([...audibleTrackIds(project)]).toEqual([double.id])
  })

  it('marks edited chains as custom and keeps them on genre changes', () => {
    let project = addVocalTrack(createProject('punk'), 'lead')
    const [first, second] = project.tracks
    project = updateChain(project, first.id, { reverbMix: 0.5 })
    project = setGenre(project, 'reggaeton')
    expect(project.tracks[0].presetId).toBe('custom')
    expect(project.tracks[0].chain?.reverbMix).toBe(0.5)
    expect(project.tracks.find((track) => track.id === second.id)?.presetId).toBe('reggaeton-lead')
    project = applyPreset(project, first.id, 'telephone')
    expect(project.tracks[0].chain?.highCut).toBe(3200)
  })

  it('restores saved projects and rejects junk', () => {
    const saved = JSON.parse(JSON.stringify(createProject())) as unknown
    expect(migrateProject(saved)?.tracks).toHaveLength(1)
    expect(migrateProject({ nope: true })).toBeUndefined()
  })
})
