import type { ButterchurnVisualizer } from 'butterchurn'

/**
 * MilkDrop, the Winamp visualizer, running in WebGL via butterchurn (MIT).
 * Loaded only when picked, so the ~800 KB of shaders and presets don't slow the rest of the app.
 */
export interface MilkDrop {
  render: () => void
  resize: (width: number, height: number) => void
  next: () => string
  presetName: () => string
  dispose: () => void
}

export function supportsWebGL2() {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'))
  } catch {
    return false
  }
}

/** The packages are UMD builds; depending on the bundler the API sits on the module, its default, or default.default. */
function unwrap<T>(module: unknown, key: string): T {
  let current = module as Record<string, unknown> | undefined
  for (let depth = 0; depth < 3 && current; depth += 1) {
    if (typeof current[key] === 'function') return current as T
    current = current.default as Record<string, unknown> | undefined
  }
  throw new Error(`MilkDrop library is missing ${key}`)
}

export async function createMilkDrop(context: AudioContext, source: AudioNode, canvas: HTMLCanvasElement, width: number, height: number): Promise<MilkDrop> {
  const [butterchurnModule, presetModule] = await Promise.all([import('butterchurn'), import('butterchurn-presets')])
  const butterchurn = unwrap<typeof butterchurnModule.default>(butterchurnModule, 'createVisualizer')
  const presetPack = unwrap<typeof presetModule.default>(presetModule, 'getPresets')
  const presets = presetPack.getPresets()
  const names = Object.keys(presets)
  const visualizer: ButterchurnVisualizer = butterchurn.createVisualizer(context, canvas, { width, height, pixelRatio: 1, textureRatio: 1 })
  visualizer.connectAudio(source)
  let current = ''
  const next = () => {
    let pick = names[Math.floor(Math.random() * names.length)]
    if (pick === current && names.length > 1) pick = names[(names.indexOf(pick) + 1) % names.length]
    current = pick
    visualizer.loadPreset(presets[pick], 2.5)
    return pick
  }
  next()
  return {
    render: () => visualizer.render(),
    resize: (w, h) => visualizer.setRendererSize(w, h),
    next,
    presetName: () => current,
    dispose: () => {
      try { visualizer.disconnectAudio(source) } catch { /* already gone */ }
    },
  }
}
