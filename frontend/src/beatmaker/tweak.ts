import type { SynthPatch } from './genres'

/** Plain-word sound changes that the chat (and the song editor) can ask for. */
export type SynthTweak = 'darker' | 'brighter' | 'heavier' | 'cleaner' | 'spacier' | 'drier' | 'wider'

export const SYNTH_TWEAKS: SynthTweak[] = ['darker', 'brighter', 'heavier', 'cleaner', 'spacier', 'drier', 'wider']

/** Small, audible nudges to a patch for chat requests like "make the synth darker". */
export function tweakPatch(patch: SynthPatch, tweak: SynthTweak): SynthPatch {
  const clamp = (value: number) => Math.max(0, Math.min(1, value))
  const name = `${patch.name.replace(/ \(edited\)$/, '')} (edited)`
  switch (tweak) {
    case 'darker': return { ...patch, name, cutoff: Math.max(150, patch.cutoff * 0.6) }
    case 'brighter': return { ...patch, name, cutoff: Math.min(14000, patch.cutoff * 1.6) }
    case 'heavier': return { ...patch, name, drive: clamp(patch.drive + 0.3) }
    case 'cleaner': return { ...patch, name, drive: 0 }
    case 'spacier': return { ...patch, name, reverb: clamp(patch.reverb + 0.25), delay: clamp(patch.delay + 0.15) }
    case 'drier': return { ...patch, name, reverb: clamp(patch.reverb - 0.25), delay: 0 }
    case 'wider': return { ...patch, name, chorus: clamp(patch.chorus + 0.35) }
  }
}

