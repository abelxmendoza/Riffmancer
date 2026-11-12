import { useEffect, useRef, useState } from 'react'
import { setFollowSong, setTheme, useThemeState } from '../theme/store'
import { APP_THEMES, getAppTheme, type AppTheme } from '../theme/themes'

function Swatch({ theme, size = 'h-5 w-5' }: { theme: AppTheme; size?: string }) {
  const { background, primary, secondary } = theme.colors
  return <span aria-hidden className={`${size} shrink-0 rounded-full border border-white/15`} style={{ background: `conic-gradient(${primary} 0 45%, ${secondary} 45% 75%, ${background} 75%)` }} />
}

/** Theme buttons and the "match my song" switch. Used in the nav popover and the mobile menu. */
export function ThemeChoices({ onPick }: { onPick?: () => void }) {
  const state = useThemeState()
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {APP_THEMES.map((theme) => {
          const active = theme.id === state.id
          return (
            <button
              key={theme.id}
              type="button"
              aria-pressed={active}
              onClick={() => { setTheme(theme.id); onPick?.() }}
              className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition ${active ? 'border-primary bg-primary/10' : 'border-foreground/10 hover:border-foreground/30'}`}
            >
              <Swatch theme={theme} />
              <span className="min-w-0">
                <span className="block truncate text-xs font-black text-foreground">{theme.name}</span>
                <span className="block truncate text-[10px] text-foreground/50">{theme.vibe}</span>
              </span>
            </button>
          )
        })}
      </div>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-xs text-foreground/75 hover:bg-foreground/5">
        <span><span className="block font-bold text-foreground">Match my song</span><span className="text-[10px] text-foreground/50">Colours follow the genre you're working on</span></span>
        <input type="checkbox" checked={state.follow} onChange={(event) => setFollowSong(event.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
      </label>
    </div>
  )
}

/** Small round button in the nav that opens the theme choices. */
export function ThemePicker() {
  const state = useThemeState()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [open])

  const theme = getAppTheme(state.id)
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Colour theme: ${theme.name}`}
        title={`Colour theme: ${theme.name}`}
        className="grid h-9 w-9 place-items-center rounded-full border border-foreground/15 transition hover:border-primary"
      >
        <Swatch theme={theme} size="h-5 w-5" />
      </button>
      {open && (
        <div role="dialog" aria-label="Colour theme" className="absolute right-0 top-11 z-[70] w-72 rounded-2xl border border-foreground/15 bg-surface p-3 shadow-2xl shadow-black/50">
          <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/50">Colour theme</p>
          <ThemeChoices />
        </div>
      )}
    </div>
  )
}
