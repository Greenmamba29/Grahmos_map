import { describe, expect, it } from 'vitest'
import { createDemoVenue } from '../indoor/demoVenue'
import { blockedNodesFor, parseVenue } from '../indoor/venuePackage'
import type { Annotation } from '../mesh/protocol'
import { IndoorRouter, MinHeap } from './router'

const venue = createDemoVenue()
const router = new IndoorRouter(venue)

describe('IndoorRouter', () => {
  it('builds a connected graph for every level', () => {
    const start = 'L1-main-lobby:node'
    for (const space of venue.spaces.filter((s) => s.entranceNodeId)) {
      expect(router.route(start, space.entranceNodeId!), space.name).toBeDefined()
    }
  })

  it('routes across floors and produces readable steps', () => {
    const route = router.route('L1-main-lobby:node', 'L3-emergency-operations-center:node')!
    expect(route.nodes.at(-1)!.levelId).toBe('L3')
    expect(route.steps[0].kind).toBe('depart')
    expect(route.steps.at(-1)!.kind).toBe('arrive')
    expect(route.steps.some((s) => s.kind === 'level' && s.instruction.includes('Level 3'))).toBe(true)
    expect(route.seconds).toBeGreaterThan(30)
  })

  it('uses only the elevator when step-free routing is requested', () => {
    const route = router.route('L1-main-lobby:node', 'L3-server-room:node', { stepFree: true })!
    expect(route.legs.some((l) => l.kind === 'stairs')).toBe(false)
    expect(route.legs.some((l) => l.kind === 'elevator')).toBe(true)
  })

  it('reroutes around closures reported over the mesh', () => {
    const base = router.route('L1-first-aid-station:node', 'L1-supply-depot:node')!
    const closure: Annotation = {
      id: 'c1', venueId: venue.id, type: 'closure', levelId: 'L1', position: [39, 25], radius: 2,
      text: 'Collapsed ceiling', author: 'x', authorName: 'x', createdAt: 0, resolved: false,
    }
    const blocked = blockedNodesFor(venue, [closure])
    expect(blocked.has('L1:corridor:39')).toBe(true)
    const detour = router.route('L1-first-aid-station:node', 'L1-supply-depot:node', { blockedNodes: blocked })
    // The only ground-floor corridor is cut, so the detour climbs a floor.
    expect(detour).toBeDefined()
    expect(detour!.seconds).toBeGreaterThan(base.seconds)
    expect(detour!.nodes.some((n) => blocked.has(n.id))).toBe(false)
  })

  it('returns undefined when the destination itself is closed', () => {
    const blocked = new Set(['L1-cafe-meridian:node'])
    expect(router.route('L1-main-lobby:node', 'L1-cafe-meridian:node', { blockedNodes: blocked })).toBeUndefined()
  })

  it('finds the nearest node on a level', () => {
    expect(router.nearestNode('L2', [1, 25])!.levelId).toBe('L2')
  })
})

describe('MinHeap', () => {
  it('pops in priority order', () => {
    const heap = new MinHeap<number>()
    for (const n of [5, 1, 4, 2, 3]) heap.push(n, n)
    expect([heap.pop(), heap.pop(), heap.pop(), heap.pop(), heap.pop()]).toEqual([1, 2, 3, 4, 5])
  })
})

describe('venue packages', () => {
  it('round-trips the demo venue through validation', () => {
    expect(parseVenue(JSON.stringify(venue)).id).toBe(venue.id)
  })

  it('rejects malformed packages', () => {
    expect(() => parseVenue({ schema: 'nope' })).toThrow(/schema/)
    const broken = { ...venue, edges: [{ from: 'missing', to: 'L1:corridor:2', kind: 'walk' }] }
    expect(() => parseVenue(broken)).toThrow(/unknown node/)
  })
})
