import type { Place } from '../indoor/search'
import type { IndoorRouter, Route, RouteOptions } from './router'

/** Fastest route from a node to any place matching `predicate` (e.g. nearest exit). */
export function routeToNearest(
  router: IndoorRouter,
  fromNodeId: string,
  places: Place[],
  predicate: (place: Place) => boolean,
  options: RouteOptions = {},
): { place: Place; route: Route } | undefined {
  let best: { place: Place; route: Route } | undefined
  for (const place of places) {
    if (!place.nodeId || !predicate(place)) continue
    const route = router.route(fromNodeId, place.nodeId, options)
    if (route && (!best || route.seconds < best.route.seconds)) best = { place, route }
  }
  return best
}
