import { useId } from 'react'
import type { Mood } from '../../assistant/engine'

const INK = '#0B1210'
const GLOW = '#A3E635'
const ACCENT = '#22C55E'
const JOINT = '#1E2A25'
const SPARK = '#FACC15'

export type FretPose = 'head' | 'full'

interface FretBotProps {
  mood?: Mood
  /** head: chat bar and avatars. full: the whole figure (landing hero). */
  pose?: FretPose
  /** Rendered width in px. */
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

const FULL_BOX = [0, -50, 206, 346] as const
const SHELL = '#1A2621'

/* An arm as two strokes: the ink outline under the bone plating. */
function Limb({ d, bone, w = 14 }: { d: string; bone: string; w?: number }) {
  return (
    <g>
      <path d={d} fill="none" stroke={INK} strokeWidth={w + 5} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={bone} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

/** Fret's body for the full pose, in a 200 × 270 box: a speaker on his chest,
 *  a microphone in his right hand and the horns in his left. */
function Figure({ bone }: { bone: string }) {
  return (
    <g className="fb-figure">
      {/* legs and boots */}
      <rect x={78} y={176} width={18} height={26} rx={7} fill={bone} stroke={INK} strokeWidth={3} />
      <rect x={104} y={176} width={18} height={26} rx={7} fill={bone} stroke={INK} strokeWidth={3} />
      <circle cx={87} cy={205} r={7} fill={JOINT} stroke={INK} strokeWidth={2} />
      <circle cx={113} cy={205} r={7} fill={JOINT} stroke={INK} strokeWidth={2} />
      <path d="M74 211H100L98 244H76Z" fill={bone} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d="M100 211H126L124 244H102Z" fill={bone} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d="M79 218 80 236M121 218 120 236" stroke={ACCENT} strokeWidth={4} strokeLinecap="round" />
      <path d="M66 258Q66 242 80 242H96Q102 242 102 250V258Z" fill={SHELL} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d="M98 258V250Q98 242 104 242H120Q134 242 134 258Z" fill={SHELL} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      {/* hips and torso */}
      <rect x={76} y={164} width={48} height={16} rx={7} fill={JOINT} stroke={INK} strokeWidth={2.5} />
      <rect x={88} y={98} width={24} height={16} rx={5} fill={JOINT} />
      <path d="M62 116Q100 102 138 116L132 166Q100 178 68 166Z" fill={bone} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d="M70 124 75 158M130 124 125 158" stroke={ACCENT} strokeWidth={4} strokeLinecap="round" />
      {/* chest speaker: it thumps */}
      <circle cx={100} cy={140} r={15} fill={SHELL} stroke={INK} strokeWidth={2.5} />
      <g className="fb-speaker">
        <circle cx={100} cy={140} r={10} fill="#05100C" stroke={GLOW} strokeWidth={2} />
        <circle cx={100} cy={140} r={4} fill={GLOW} />
      </g>
      {/* his right arm (viewer's left): a microphone */}
      <g className="fb-mic">
        <Limb d="M62 122 44 146 42 128" bone={bone} />
        <circle cx={44} cy={146} r={6} fill={JOINT} />
        <rect x={36} y={100} width={11} height={30} rx={4} fill={JOINT} stroke={INK} strokeWidth={2.5} transform="rotate(-12 41 115)" />
        <circle cx={38} cy={96} r={11} fill="#9FB3A7" stroke={INK} strokeWidth={2.5} />
        <path d="M30 92 46 100M30 100 46 92M38 85V107" stroke={INK} strokeOpacity={0.45} strokeWidth={1.4} />
        <rect x={33} y={122} width={16} height={13} rx={6} fill={JOINT} stroke={INK} strokeWidth={2.5} />
      </g>
      <circle cx={62} cy={121} r={11} fill={bone} stroke={INK} strokeWidth={3} />
      {/* his left arm (viewer's right): the horns, index and pinky up, thumb across */}
      <g className="fb-horns">
        <Limb d="M138 122 164 142 174 118" bone={bone} />
        <circle cx={164} cy={142} r={6} fill={JOINT} />
        <rect x={160} y={74} width={8} height={28} rx={4} fill={JOINT} stroke={INK} strokeWidth={2.2} />
        <rect x={183} y={78} width={8} height={24} rx={4} fill={JOINT} stroke={INK} strokeWidth={2.2} />
        <rect x={158} y={96} width={35} height={22} rx={8} fill={JOINT} stroke={INK} strokeWidth={2.5} />
        <path d="M170 99V106M178 99V106" stroke="#3F5249" strokeWidth={2} strokeLinecap="round" />
        <rect x={163} y={106} width={22} height={8} rx={4} fill="#33453D" stroke={INK} strokeWidth={2} />
      </g>
      <circle cx={138} cy={121} r={11} fill={bone} stroke={INK} strokeWidth={3} />
    </g>
  )
}

/**
 * Fret, Riffmancer's mascot: a bone-white skull-bot with a guitar-headstock crest,
 * headphone ear pods, a dark visor with glowing eyes, and piano-key teeth.
 * Pure SVG so it scales from a 22px icon to a hero illustration.
 */
export function FretBot({ mood = 'idle', pose = 'head', size = 42, still = false, title, className = '' }: FretBotProps) {
  const id = useId().replace(/:/g, '')
  const bone = `fb-bone-${id}`
  const visor = `fb-visor-${id}`
  const metal = `fb-metal-${id}`
  const glow = `fb-glow-${id}`
  return (
    <svg
      className={`fretbot fb-${mood} fb-pose-${pose} ${still ? 'fb-still' : ''} ${className}`}
      width={size}
      height={size * (pose === 'full' ? FULL_BOX[3] / FULL_BOX[2] : 140 / 128)}
      viewBox={pose === 'full' ? FULL_BOX.join(' ') : '-4 -30 128 140'}
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
        {pose === 'full' && <g transform="translate(0 30)"><Figure bone={`url(#${bone})`} /></g>}
        <g transform={pose === 'full' ? 'translate(18 -6) scale(1.36)' : undefined}>
        <g className="fb-head">
          {/* Guitar headstock crest with tuning pegs */}
          <g className="fb-crest">
            <rect x={53} y={10} width={14} height={24} fill={JOINT} stroke={INK} strokeWidth={3} />
            <path d="M55 18h10M55 25h10" stroke="#C9D6C4" strokeWidth={1.5} />
            <path d="M50 14 45 -16q15-14 30 0l-5 30z" fill={`url(#${bone})`} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
            <path d="M53 10 49.5 -13.5q10.5-9 21 0L67 10z" fill={`url(#${metal})`} />
            <path d="M54 -8q6-4 12 0" stroke={GLOW} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.8} />
            {[-10, -1, 8].map((y, index) => (
              <g key={y} className="fb-peg">
                <circle cx={44 - index * 0.5} cy={y} r={4} fill={ACCENT} stroke={INK} strokeWidth={2.5} />
                <circle cx={76 + index * 0.5} cy={y} r={4} fill={ACCENT} stroke={INK} strokeWidth={2.5} />
              </g>
            ))}
            <path d="M57 -4v18M60 -6v20M63 -4v18" stroke={GLOW} strokeWidth={1} />
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
      </g>
    </svg>
  )
}
