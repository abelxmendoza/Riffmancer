import { useEffect, useState } from 'react'
import { ProjectLibrary } from './components/ProjectLibrary'
import { UploadPanel } from './components/UploadPanel'
import { BrandMark } from './components/BrandMark'
import { SeparationWorkspace } from './components/SeparationWorkspace'
import { listProjects, uploadProject } from './services/api'
import type { Project } from './types'

export default function App() {
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
    <div className="min-h-screen bg-charcoal text-zinc-100">
      <div className="mx-auto max-w-[1500px] p-4 sm:p-6">
        <header className="mb-6 flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="text-phantom"><BrandMark className="h-11 w-11" /></div>
            <div>
              <p className="font-display text-base font-black uppercase tracking-wider text-white">Riffmancer</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">Audio to arrangement</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500"><span className="h-2 w-2 rounded-full bg-phantom" /> Local workstation</div>
        </header>
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <ProjectLibrary projects={projects} selectedId={selected?.id} onSelect={setSelected} />
          <main className="min-w-0 space-y-6">
            <UploadPanel busy={uploading} progress={progress} onFile={upload} />
            {error && <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200"><strong className="mr-2">Import failed.</strong>{error}</div>}
            {loading && <div className="rounded-3xl border border-white/10 bg-panel p-16 text-center text-sm text-zinc-500">Opening local library…</div>}
            {!loading && selected && <SeparationWorkspace project={selected} />}
            {!loading && !selected && (
              <section className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-white/10 bg-white/[0.015] p-8 text-center">
                <div><p className="text-2xl font-black text-white">Your rehearsal workspace starts here.</p><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-zinc-500">Import one of your Suno tracks above. Riffmancer will validate it, keep the original safe, and open a seekable waveform.</p></div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
