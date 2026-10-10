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
    <aside className="rounded-3xl border border-foreground/10 bg-surface p-3 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between px-3 pb-3 pt-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/50">Local library</p>
          <h2 className="mt-1 text-lg font-bold text-foreground">Your songs</h2>
        </div>
        <span className="rounded-full bg-foreground/5 px-2.5 py-1 text-xs font-semibold text-foreground/70">{projects.length}</span>
      </div>
      <div className="space-y-2 overflow-y-auto lg:max-h-[calc(100vh-8rem)]">
        {projects.length === 0 && (
          <div className="m-1 rounded-2xl border border-dashed border-foreground/10 px-5 py-12 text-center">
            <MusicIcon className="mx-auto mb-3 text-foreground/35" />
            <p className="text-sm font-semibold text-foreground/80">No songs yet</p>
            <p className="mt-1 text-xs leading-5 text-foreground/50">Import a track to start a rehearsal-ready project.</p>
          </div>
        )}
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => onSelect(project)}
            className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === project.id ? 'border-primary/40 bg-primary/10' : 'border-transparent bg-foreground/[0.025] hover:border-foreground/10 hover:bg-foreground/5'}`}
          >
            <div className="flex items-center gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${selectedId === project.id ? 'bg-primary text-background' : 'bg-foreground/5 text-foreground/50'}`}><MusicIcon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-foreground">{project.title}</span>
                <span className="mt-1 block text-xs text-foreground/50">{formatTime(project.audio.duration_seconds)} · {project.audio.codec_name.toUpperCase()}</span>
              </span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  )
}
