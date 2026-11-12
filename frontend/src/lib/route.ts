import { useEffect, useState } from 'react'

export type Route = 'home' | 'beats' | 'stems' | 'player'

const ROUTES: Record<string, Route> = { '': 'home', '#/': 'home', '#/beats': 'beats', '#/stems': 'stems', '#/player': 'player' }

export function routeFromHash(hash: string): Route {
  return ROUTES[hash] ?? 'home'
}

export const hrefFor = (route: Route) => (route === 'home' ? '#/' : `#/${route}`)

/** Tiny hash router: works on static hosting (Vercel, file previews) with no server rewrites. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => routeFromHash(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(routeFromHash(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
