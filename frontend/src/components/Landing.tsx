import { GENRES } from '../beatmaker/genres'
import { hrefFor } from '../lib/route'

const STEPS = [
  { title: 'Pick a genre', body: 'Post punk, metal, punk, drum & bass, reggaeton and more. Each one loads a real drummer, bassist and sound.' },
  { title: 'Press play', body: 'The backing band starts in the right tempo, key and groove. Nothing to program.' },
  { title: 'Play anything', body: 'Left hand picks the chords, right hand plays the synth. Every key fits, so there are no wrong notes.' },
]

const FEATURES = [
  { title: 'MIDI keyboard ready', body: 'Plug in any USB or Bluetooth MIDI keyboard or pad controller. No keyboard? Your computer keys work too.' },
  { title: 'A band that follows you', body: 'Change chords and the drums and bass change with you, instantly.' },
  { title: 'No wrong notes', body: 'Scale lock snaps every note into the song’s key, so it always sounds right.' },
  { title: 'Real synthesizer', body: 'Fat saws, Reese bass, chorus guitars, 808 subs. Tweak with knobs named for humans.' },
  { title: 'Drum grid + pads', body: 'Finger-drum on pads, record hits straight into the beat, add fills and variations.' },
  { title: 'Record and download', body: 'Capture a take of everything you hear and download it in one click.' },
]

export function Landing() {
  return (
    <div className="space-y-20 pb-16">
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-surface px-6 py-12 sm:px-12 sm:py-16">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-secondary">MIDI keyboard beat maker</p>
            <h1 className="mt-4 font-display text-4xl font-black uppercase leading-[1.05] text-foreground sm:text-6xl">
              Make heavy beats.<br /><span className="text-primary">Skip the theory.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-foreground/65">
              Riffmancer turns your MIDI keyboard into a full band. Pick a genre, press play, and jam: drums, bass and chords follow every key you hit, and nothing you play is ever out of key.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={hrefFor('beats')} className="rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-wider text-background shadow-[0_0_30px_rgba(163,230,53,0.3)] hover:bg-secondary">Start making beats</a>
              <a href="#genres" onClick={(event) => { event.preventDefault(); document.getElementById('genres')?.scrollIntoView({ behavior: 'smooth' }) }} className="rounded-full border border-foreground/15 px-6 py-3 text-sm font-black uppercase tracking-wider text-foreground/80 hover:border-secondary hover:text-foreground">See the genres</a>
            </div>
            <p className="mt-6 text-xs text-foreground/40">Free, runs in your browser. Best in Chrome or Edge for MIDI.</p>
          </div>
          <img src="/riffmancer-emblem.png" alt="Riffmancer skull emblem made of musical notation" className="mx-auto w-full max-w-[420px] rounded-3xl" />
        </div>
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="text-xs font-black uppercase tracking-[0.3em] text-foreground/50">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-3xl border border-foreground/10 bg-surface p-6">
              <span className="font-display text-4xl font-black text-primary">{index + 1}</span>
              <h3 className="mt-3 text-lg font-black text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-foreground/55">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="genres" aria-labelledby="genres-title" className="scroll-mt-24">
        <h2 id="genres-title" className="text-xs font-black uppercase tracking-[0.3em] text-foreground/50">Genres</h2>
        <p className="mt-3 max-w-2xl text-2xl font-black text-foreground">Tuned for the loud stuff, with more on the way.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GENRES.map((genre) => (
            <a key={genre.id} href={hrefFor('beats')} onClick={() => { try { window.localStorage.setItem('riffmancer.beatmaker.pendingGenre', genre.id) } catch { /* storage blocked */ } }} className={`group rounded-3xl border p-5 transition hover:border-primary ${genre.primary ? 'border-foreground/15 bg-surface' : 'border-foreground/10 bg-background'}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-lg font-black uppercase text-foreground group-hover:text-primary">{genre.name}</h3>
                <span className="font-mono text-xs text-foreground/40">{genre.bpm.default} BPM</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-foreground/55">{genre.tagline}</p>
              <span className="mt-4 inline-block text-xs font-black uppercase tracking-wider text-secondary">Jam in {genre.name} →</span>
            </a>
          ))}
        </div>
      </section>

      <section aria-labelledby="features">
        <h2 id="features" className="text-xs font-black uppercase tracking-[0.3em] text-foreground/50">Everything you need</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-3xl border border-foreground/10 bg-surface p-6">
              <h3 className="text-base font-black text-primary">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-foreground/55">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-primary/25 bg-primary/10 px-6 py-12 text-center">
        <p className="font-display text-3xl font-black uppercase text-foreground">Plug in. Press play. Riff.</p>
        <a href={hrefFor('beats')} className="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-wider text-background hover:bg-secondary">Open the Beat Maker</a>
        <p className="mt-6 text-xs text-foreground/45">Got a finished song instead? <a className="font-bold text-secondary underline" href={hrefFor('stems')}>Split it into stems in the Stem Lab.</a></p>
      </section>

      <footer className="border-t border-foreground/10 pt-6 text-xs text-foreground/35">Riffmancer · Sound powered by Tone.js · Made for musicians who just want to play.</footer>
    </div>
  )
}
