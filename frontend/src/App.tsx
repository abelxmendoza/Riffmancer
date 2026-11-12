import { useEffect, useState } from 'react'
import { ProjectLibrary } from './components/ProjectLibrary'
import { UploadPanel } from './components/UploadPanel'
import { ChatBar } from './components/assistant/ChatBar'
import { Landing } from './components/Landing'
import { NavBar } from './components/NavBar'
import { useRoute } from './lib/route'
import { SeparationWorkspace } from './components/SeparationWorkspace'
import { BeatMaker } from './components/beatmaker/BeatMaker'
import { Studio } from './components/studio/Studio'
import { Player } from './components/player/Player'
import { listProjects, uploadProject } from './services/api'
import type { Project } from './types'

function StemLab() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selected, setSelected] = useState<Project>()
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string>()

  useEffect(() => {
    listProjects()
      .then((items) => { setProjects(items); setSelected(items[0]) })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load the project library.'))
      .finally(() => setLoading(false))
  }, [])

  const upload = async (file: File) => {
    setUploading(true)
    setProgress(0)
    setError(undefined)
    try {
      const project = await uploadProject(file, setProgress)
      setProjects((current) => [project, ...current])
      setSelected(project)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <ProjectLibrary projects={projects} selectedId={selected?.id} onSelect={setSelected} />
      <main className="min-w-0 space-y-6">
        <UploadPanel busy={uploading} progress={progress} onFile={upload} />
        {error && <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200"><strong className="mr-2">Import failed.</strong>{error}</div>}
        {loading && <div className="rounded-3xl border border-foreground/10 bg-surface p-16 text-center text-sm text-foreground/50">Opening local library…</div>}
        {!loading && selected && <SeparationWorkspace project={selected} />}
        {!loading && !selected && (
          <section className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-foreground/10 bg-foreground/[0.015] p-8 text-center">
            <div><img src="/riffmancer-emblem.webp" width={160} height={160} alt="" className="mx-auto mb-5 w-40 rounded-2xl" /><p className="text-2xl font-black text-foreground">Your rehearsal workspace starts here.</p><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-foreground/50">Import one of your Suno tracks above. Riffmancer will validate it, keep the original safe, and open a seekable waveform.</p></div>
          </section>
        )}
      </main>
    </div>
  )
}

export default function App() {
  const route = useRoute()
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar route={route} />
      <div className="mx-auto max-w-[1500px] p-4 pb-32 sm:p-6 sm:pb-32">
        {route === 'home' && <Landing />}
        {route === 'beats' && <BeatMaker />}
        {route === 'studio' && <Studio />}
        {route === 'stems' && <StemLab />}
        {route === 'player' && <Player />}
      </div>
      <ChatBar route={route} />
    </div>
  )
}
