import { useId } from 'react'
import type { Mood } from '../../assistant/engine'

const INK = '#0B1210'
const GLOW = '#A3E635'
const ACCENT = '#22C55E'
const JOINT = '#1E2A25'
const SPARK = '#FACC15'

interface FretBotProps {
  mood?: Mood
  size?: number
  /** No animation (used for the small avatar next to each message). */
  still?: boolean
  title?: string
  className?: string
}

function Eyes({ mood, glow }: { mood: Mood; glow: string }) {
  const pill = (x: number) => <rect className="fb-eye" x={x - 6} y={60} width={12} height={20} rx={6} fill={GLOW} filter={glow} />
  switch (mood) {
    case 'thinking':
      return (
        <g>
          {pill(46)}
          <path d="M66 72q8-8 16 0" stroke={GLOW} strokeWidth={5} strokeLinecap="round" fill="none" filter={glow} />
          <text className="fb-question" x={92} y={20} fontSize={24} fontWeight={900} fill={GLOW} fontFamily="Arial Black, sans-serif">?</text>
        </g>
      )
    case 'ready':
      return (
        <g filter={glow}>
          <path d="M38 74l8-9 8 9M66 74l8-9 8 9" stroke={GLOW} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <g className="fb-spark" fill={SPARK}><path d="M100 22l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" /></g>
        </g>
      )
    case 'rocking':
      return (
        <g filter={glow}>
          <path d="M37 66l17 8M83 66l-17 8" stroke={GLOW} strokeWidth={6} strokeLinecap="round" />
          <g className="fb-note" fill={GLOW}><path d="M98 10v16a5 5 0 1 1-3-4.6V6l12-3v6z" /></g>
          <g className="fb-note fb-note-2" fill={ACCENT}><path d="M14 22v13a4 4 0 1 1-2.6-3.8V18l9-2v5z" /></g>
        </g>
      )
    case 'confused':
      return (
        <g>
          <path d="M38 64l15 6M82 64l-15 6" stroke={GLOW} strokeWidth={5} strokeLinecap="round" filter={glow} />
          <path d="M40 80h12M68 80h12" stroke={GLOW} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
          <path className="fb-drip" d="M104 40c0 5-3 8-6 8s-6-3-6-8 6-12 6-12 6 7 6 12z" fill="#38BDF8" stroke={INK} strokeWidth={2} />
        </g>
      )
    case 'listening':
      return <g className="fb-glance">{pill(46)}{pill(74)}</g>
    default:
      return <g>{pill(46)}{pill(74)}</g>
  }
}

/**
 * Fret, Riffmancer's mascot: a bone-white skull-bot with a guitar-headstock crest,
 * headphone ear pods, a dark visor with glowing eyes, and piano-key teeth.
 * Pure SVG so it scales from a 22px icon to a hero illustration.
 */
export function FretBot({ mood = 'idle', size = 42, still = false, title, className = '' }: FretBotProps) {
  const id = useId().replace(/:/g, '')
  const bone = `fb-bone-${id}`
  const visor = `fb-visor-${id}`
  const metal = `fb-metal-${id}`
  const glow = `fb-glow-${id}`
  return (
    <svg
      className={`fretbot fb-${mood} ${still ? 'fb-still' : ''} ${className}`}
      width={size}
      height={size * (140 / 128)}
      viewBox="-4 -30 128 140"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={bone} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBFFF7" />
          <stop offset=".55" stopColor="#E3EEDD" />
          <stop offset="1" stopColor="#B9C9B3" />
        </linearGradient>
        <linearGradient id={visor} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#13221C" />
          <stop offset="1" stopColor="#040807" />
        </linearGradient>
        <linearGradient id={metal} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B4A43" />
          <stop offset="1" stopColor="#161F1B" />
        </linearGradient>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g className="fb-body">
        <g className="fb-head">
          {/* Guitar headstock crest with tuning pegs */}
          <g className="fb-crest">
            <rect x={53} y={10} width={14} height={24} fill={JOINT} stroke={INK} strokeWidth={3} />
            <path d="M55 18h10M55 25h10" stroke="#C9D6C4" strokeWidth={1.5} />
            <path d="M50 14 45 -16q15-14 30 0l-5 30z" fill={`url(#${metal})`} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
            <path d="M54 -8q6-4 12 0" stroke={GLOW} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.8} />
            {[-10, -1, 8].map((y, index) => (
              <g key={y} className="fb-peg">
                <circle cx={44 - index * 0.5} cy={y} r={4} fill={ACCENT} stroke={INK} strokeWidth={2.5} />
                <circle cx={76 + index * 0.5} cy={y} r={4} fill={ACCENT} stroke={INK} strokeWidth={2.5} />
              </g>
            ))}
            <path d="M57 -4v18M60 -6v20M63 -4v18" stroke="#E5F7E7" strokeWidth={0.9} opacity={0.7} />
          </g>
          {/* Headphone ear pods */}
          <g className="fb-ears">
            <circle cx={14} cy={68} r={13} fill={JOINT} stroke={INK} strokeWidth={3} />
            <circle className="fb-ear-ring" cx={14} cy={68} r={6.5} fill="none" stroke={GLOW} strokeWidth={2.5} />
            <circle cx={106} cy={68} r={13} fill={JOINT} stroke={INK} strokeWidth={3} />
            <circle className="fb-ear-ring" cx={106} cy={68} r={6.5} fill="none" stroke={GLOW} strokeWidth={2.5} />
          </g>
          {/* Bone helmet */}
          <rect x={14} y={30} width={92} height={78} rx={36} fill={`url(#${bone})`} stroke={INK} strokeWidth={3} />
          <ellipse cx={40} cy={42} rx={14} ry={5} fill="#fff" opacity={0.75} transform="rotate(-18 40 42)" />
          <path d="M24 52q36-22 72 0" stroke={ACCENT} strokeWidth={4} strokeLinecap="round" fill="none" />
          {/* Visor */}
          <rect x={24} y={52} width={72} height={38} rx={18} fill={`url(#${visor})`} stroke={INK} strokeWidth={3} />
          <path d="M32 58q12-4 22-2" stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.18} fill="none" />
          <Eyes mood={mood} glow={`url(#${glow})`} />
          {/* Piano-key teeth */}
          <g className="fb-teeth">
            <rect x={38} y={92} width={44} height={12} rx={3} fill="#F7FBF3" stroke={INK} strokeWidth={2.5} />
            <path d="M49 92v12M60 92v12M71 92v12" stroke={INK} strokeWidth={1.8} />
            <rect x={46} y={92} width={5} height={7} fill={INK} />
            <rect x={57} y={92} width={5} height={7} fill={INK} />
            <rect x={68} y={92} width={5} height={7} fill={INK} />
          </g>
        </g>
      </g>
    </svg>
  )
}
