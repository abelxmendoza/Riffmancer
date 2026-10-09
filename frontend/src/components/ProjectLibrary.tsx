import type { Project } from '../types'
import { formatTime } from '../lib/format'
import { MusicIcon } from './Icons'

interface ProjectLibraryProps {
  projects: Project[]
  selectedId?: string
  onSelect: (project: Project) => void
}

export function ProjectLibrary({ projects, selectedId, onSelect }: ProjectLibraryProps) {
  return (
    <aside className="rounded-3xl border border-white/10 bg-panel p-3 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between px-3 pb-3 pt-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Local library</p>
          <h2 className="mt-1 text-lg font-bold text-white">Your songs</h2>
        </div>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-zinc-400">{projects.length}</span>
      </div>
      <div className="space-y-2 overflow-y-auto lg:max-h-[calc(100vh-8rem)]">
        {projects.length === 0 && (
          <div className="m-1 rounded-2xl border border-dashed border-white/10 px-5 py-12 text-center">
            <MusicIcon className="mx-auto mb-3 text-zinc-600" />
            <p className="text-sm font-semibold text-zinc-300">No songs yet</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Import a track to start a rehearsal-ready project.</p>
          </div>
        )}
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => onSelect(project)}
            className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === project.id ? 'border-phantom/40 bg-phantom/10' : 'border-transparent bg-white/[0.025] hover:border-white/10 hover:bg-white/5'}`}
          >
            <div className="flex items-center gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${selectedId === project.id ? 'bg-phantom text-charcoal' : 'bg-white/5 text-zinc-500'}`}><MusicIcon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white">{project.title}</span>
                <span className="mt-1 block text-xs text-zinc-500">{formatTime(project.audio.duration_seconds)} · {project.audio.codec_name.toUpperCase()}</span>
              </span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  )
}
