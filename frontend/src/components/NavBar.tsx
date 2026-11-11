import { useState } from 'react'
import { hrefFor, type Route } from '../lib/route'
import { BrandMark } from './BrandMark'

const LINKS: { route: Route; label: string }[] = [
  { route: 'home', label: 'Home' },
  { route: 'beats', label: 'Beat Maker' },
  { route: 'stems', label: 'Stem Lab' },
]

export function NavBar({ route }: { route: Route }) {
  const [open, setOpen] = useState(false)
  const link = (item: (typeof LINKS)[number], mobile = false) => {
    const active = item.route === route
    return (
      <a
        key={item.route}
        href={hrefFor(item.route)}
        aria-current={active ? 'page' : undefined}
        onClick={() => setOpen(false)}
        className={mobile
          ? `block rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wider ${active ? 'bg-primary text-background' : 'text-foreground/70 hover:bg-foreground/5'}`
          : `rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider transition ${active ? 'bg-primary text-background' : 'text-foreground/55 hover:text-foreground'}`}
      >
        {item.label}
      </a>
    )
  }
  return (
    <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/85 backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href={hrefFor('home')} className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <span className="text-primary"><BrandMark className="h-10 w-10" /></span>
          <span>
            <span className="block font-display text-base font-black uppercase tracking-wider text-foreground">Riffmancer</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/35">Beats without the theory</span>
          </span>
        </a>
        <div className="hidden items-center gap-1 rounded-full border border-foreground/10 bg-surface p-1 md:flex">
          {LINKS.map((item) => link(item))}
        </div>
        <a href={hrefFor('beats')} className="hidden rounded-full bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-background hover:bg-secondary md:inline-block">
          Start jamming
        </a>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-xl border border-foreground/10 text-foreground md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>
      {open && (
        <div id="mobile-menu" className="space-y-1 border-t border-foreground/10 px-4 py-3 md:hidden">
          {LINKS.map((item) => link(item, true))}
        </div>
      )}
    </header>
  )
}
