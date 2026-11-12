/** Lets Fret drive the music player from the chat bar. */
export type PlayerAction =
  | { type: 'toggle' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'visual'; id?: string }
  | { type: 'theme'; id: string }
  | { type: 'fullscreen' }
  | { type: 'demo' }

type Handler = (action: PlayerAction) => void
let handler: Handler | undefined
const queue: PlayerAction[] = []

export function dispatchPlayer(action: PlayerAction) {
  if (handler) handler(action)
  else queue.push(action)
}

export function registerPlayerHandler(next: Handler): () => void {
  handler = next
  for (const action of queue.splice(0)) next(action)
  return () => { if (handler === next) handler = undefined }
}
