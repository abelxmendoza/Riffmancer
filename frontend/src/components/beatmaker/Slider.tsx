interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  display?: string
  onChange: (value: number) => void
  hint?: string
}

export function Slider({ label, value, min, max, step = 0.01, display, onChange, hint }: SliderProps) {
  return (
    <label className="block" title={hint}>
      <span className="flex items-baseline justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-foreground/55">
        <span>{label}</span>
        <span className="font-mono normal-case tracking-normal text-foreground/70">{display ?? value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        className="mt-1 w-full accent-primary"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export function Panel({ title, children, actions, className = '' }: { title: string; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-foreground/10 bg-surface p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/60">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  )
}

export function Toggle({ on, label, onClick, title }: { on: boolean; label: string; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${on ? 'border-primary bg-primary text-background' : 'border-foreground/15 text-foreground/60 hover:border-secondary hover:text-foreground'}`}
    >
      {label}
    </button>
  )
}
