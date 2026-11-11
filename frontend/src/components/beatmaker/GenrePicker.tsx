import { GENRES } from '../../beatmaker/genres'

export function GenrePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const primary = GENRES.filter((genre) => genre.primary)
  const more = GENRES.filter((genre) => !genre.primary)
  const card = (genre: (typeof GENRES)[number]) => {
    const active = genre.id === value
    return (
      <button
        key={genre.id}
        type="button"
        aria-pressed={active}
        onClick={() => onChange(genre.id)}
        className={`rounded-2xl border p-3 text-left transition ${active ? 'border-primary bg-primary/10' : 'border-foreground/10 bg-background/40 hover:border-secondary/60'}`}
      >
        <span className={`block font-display text-sm font-black uppercase tracking-wide ${active ? 'text-primary' : 'text-foreground'}`}>{genre.name}</span>
        <span className="mt-1 block text-xs leading-5 text-foreground/50">{genre.tagline}</span>
        <span className="mt-2 block font-mono text-[10px] text-foreground/40">{genre.bpm.default} BPM</span>
      </button>
    )
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">{primary.map(card)}</div>
      {more.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/40">More</span>
          {more.map((genre) => (
            <button key={genre.id} type="button" aria-pressed={genre.id === value} onClick={() => onChange(genre.id)} className={`rounded-full border px-3 py-1 text-xs font-bold ${genre.id === value ? 'border-primary text-primary' : 'border-foreground/15 text-foreground/60 hover:text-foreground'}`}>
              {genre.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
