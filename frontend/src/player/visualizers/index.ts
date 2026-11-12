import { inferno } from './inferno'
import { scope } from './scope'
import { skull } from './skull'
import { spectrum } from './spectrum'
import type { CanvasVisualizer } from './types'
import { warp } from './warp'

export const CANVAS_VISUALIZERS: CanvasVisualizer[] = [skull, spectrum, warp, inferno, scope]

/** All modes in the picker. "milkdrop" is the WebGL one, loaded on demand. */
export const VISUAL_MODES = [
  ...CANVAS_VISUALIZERS.map(({ id, name, blurb }) => ({ id, name, blurb })),
  { id: 'milkdrop', name: 'MilkDrop', blurb: '100 trippy Winamp-classic presets (WebGL)' },
]

export type { CanvasVisualizer, Frame } from './types'
