import { distance, turnAngle } from '../indoor/geometry'
import type { NavEdgeKind, NavNode, Point, Venue } from '../indoor/types'

export const WALKING_SPEED_MPS = 1.3

export interface RouteOptions {
  /** Avoid stairs (wheelchairs, strollers, carts). */
  stepFree?: boolean
  /** Node ids that must not be traversed (closures reported over the mesh). */
  blockedNodes?: ReadonlySet<string>
}

export interface RouteLeg {
  from: NavNode
  to: NavNode
  kind: NavEdgeKind
  seconds: number
  meters: number
}

export interface RouteStep {
  instruction: string
  levelId: string
  meters: number
  seconds: number
  kind: 'depart' | 'straight' | 'left' | 'right' | 'slight-left' | 'slight-right' | 'u-turn' | 'level' | 'arrive'
  position: Point
}

export interface Route {
  nodes: NavNode[]
  legs: RouteLeg[]
  seconds: number
  meters: number
  steps: RouteStep[]
}

interface Adjacent {
  to: string
  kind: NavEdgeKind
  seconds: number
  meters: number
}

/** Pre-built adjacency for a venue; rebuild when the venue changes. */
export class IndoorRouter {
  readonly nodes = new Map<string, NavNode>()
  private readonly adjacency = new Map<string, Adjacent[]>()
  private readonly levelOrdinal = new Map<string, number>()
  private readonly levelName = new Map<string, string>()
  /** Cheapest observed seconds per floor of vertical travel (keeps A* admissible). */
  private minSecondsPerFloor = Infinity

  constructor(private readonly venue: Venue) {
    for (const level of venue.levels) {
      this.levelOrdinal.set(level.id, level.ordinal)
      this.levelName.set(level.id, level.name)
    }
    for (const node of venue.nodes) {
      this.nodes.set(node.id, node)
      this.adjacency.set(node.id, [])
    }
    for (const edge of venue.edges) {
      const a = this.nodes.get(edge.from)
      const b = this.nodes.get(edge.to)
      if (!a || !b) continue
      const meters = a.levelId === b.levelId ? distance(a.position, b.position) : 0
      const seconds = edge.seconds ?? meters / WALKING_SPEED_MPS
      this.adjacency.get(a.id)!.push({ to: b.id, kind: edge.kind, seconds, meters })
      this.adjacency.get(b.id)!.push({ to: a.id, kind: edge.kind, seconds, meters })
      const floors = Math.abs(
        (this.levelOrdinal.get(a.levelId) ?? 0) - (this.levelOrdinal.get(b.levelId) ?? 0),
      )
      if (floors > 0) this.minSecondsPerFloor = Math.min(this.minSecondsPerFloor, seconds / floors)
    }
    if (!Number.isFinite(this.minSecondsPerFloor)) this.minSecondsPerFloor = 0
  }

  /** Nearest walkable node to a point on a level. */
  nearestNode(levelId: string, point: Point, options: RouteOptions = {}): NavNode | undefined {
    let best: NavNode | undefined
    let bestDistance = Infinity
    for (const node of this.nodes.values()) {
      if (node.levelId !== levelId) continue
      if (options.blockedNodes?.has(node.id)) continue
      const d = distance(node.position, point)
      if (d < bestDistance) {
        bestDistance = d
        best = node
      }
    }
    return best
  }

  private heuristic(a: NavNode, b: NavNode) {
    const flat = distance(a.position, b.position) / WALKING_SPEED_MPS
    const floors = Math.abs(
      (this.levelOrdinal.get(a.levelId) ?? 0) - (this.levelOrdinal.get(b.levelId) ?? 0),
    )
    return flat + floors * this.minSecondsPerFloor
  }

  /** A* shortest-time path. Returns undefined when no path exists. */
  route(fromId: string, toId: string, options: RouteOptions = {}): Route | undefined {
    const start = this.nodes.get(fromId)
    const goal = this.nodes.get(toId)
    if (!start || !goal) return undefined
    const blocked = options.blockedNodes
    if (blocked?.has(goal.id)) return undefined

    const g = new Map<string, number>([[start.id, 0]])
    const came = new Map<string, { prev: string; edge: Adjacent }>()
    const open = new MinHeap<string>()
    open.push(start.id, this.heuristic(start, goal))
    const closed = new Set<string>()

    while (open.size) {
      const current = open.pop()!
      if (current === goal.id) break
      if (closed.has(current)) continue
      closed.add(current)
      const currentCost = g.get(current)!
      for (const edge of this.adjacency.get(current) ?? []) {
        if (closed.has(edge.to)) continue
        if (options.stepFree && edge.kind === 'stairs') continue
        if (blocked?.has(edge.to) && edge.to !== goal.id) continue
        const tentative = currentCost + edge.seconds
        if (tentative < (g.get(edge.to) ?? Infinity)) {
          g.set(edge.to, tentative)
          came.set(edge.to, { prev: current, edge })
          open.push(edge.to, tentative + this.heuristic(this.nodes.get(edge.to)!, goal))
        }
      }
    }

    if (!g.has(goal.id)) return undefined
    const path: NavNode[] = [goal]
    const legs: RouteLeg[] = []
    let cursor = goal.id
    while (cursor !== start.id) {
      const step = came.get(cursor)!
      const from = this.nodes.get(step.prev)!
      legs.unshift({
        from,
        to: this.nodes.get(cursor)!,
        kind: step.edge.kind,
        seconds: step.edge.seconds,
        meters: step.edge.meters,
      })
      path.unshift(from)
      cursor = step.prev
    }
    const seconds = legs.reduce((s, l) => s + l.seconds, 0)
    const meters = legs.reduce((s, l) => s + l.meters, 0)
    return { nodes: path, legs, seconds, meters, steps: this.instructions(legs, goal) }
  }

  private instructions(legs: RouteLeg[], goal: NavNode): RouteStep[] {
    const steps: RouteStep[] = []
    if (!legs.length) {
      return [
        { instruction: 'You are already here', levelId: goal.levelId, meters: 0, seconds: 0, kind: 'arrive', position: goal.position },
      ]
    }
    steps.push({
      instruction: `Start on ${this.levelName.get(legs[0].from.levelId) ?? 'this level'}`,
      levelId: legs[0].from.levelId,
      meters: 0,
      seconds: 0,
      kind: 'depart',
      position: legs[0].from.position,
    })

    let pending: RouteStep | undefined
    const flush = () => {
      if (pending && pending.meters > 0.5) steps.push(pending)
      pending = undefined
    }

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i]
      if (leg.kind !== 'walk') {
        flush()
        // Merge consecutive vertical legs into one instruction.
        let j = i
        while (j + 1 < legs.length && legs[j + 1].kind === leg.kind) j++
        const target = legs[j].to
        const up =
          (this.levelOrdinal.get(target.levelId) ?? 0) >
          (this.levelOrdinal.get(leg.from.levelId) ?? 0)
        const via = leg.kind === 'elevator' ? 'the elevator' : 'the stairs'
        const seconds = legs.slice(i, j + 1).reduce((s, l) => s + l.seconds, 0)
        steps.push({
          instruction: `Take ${via} ${up ? 'up' : 'down'} to ${this.levelName.get(target.levelId) ?? target.levelId}`,
          levelId: target.levelId,
          meters: 0,
          seconds,
          kind: 'level',
          position: target.position,
        })
        i = j
        continue
      }

      const prevLeg = legs[i - 1]
      let kind: RouteStep['kind'] = 'straight'
      if (prevLeg && prevLeg.kind === 'walk' && prevLeg.meters > 0.5 && leg.meters > 0.5) {
        const angle = turnAngle(prevLeg.from.position, leg.from.position, leg.to.position)
        kind = classifyTurn(angle)
      }
      if (kind === 'straight' && pending) {
        pending.meters += leg.meters
        pending.seconds += leg.seconds
        continue
      }
      flush()
      pending = {
        instruction: '',
        levelId: leg.from.levelId,
        meters: leg.meters,
        seconds: leg.seconds,
        kind,
        position: leg.from.position,
      }
    }
    flush()

    for (const step of steps) {
      if (step.kind === 'depart' || step.kind === 'level') continue
      const dist = `${Math.max(1, Math.round(step.meters))} m`
      step.instruction =
        step.kind === 'straight'
          ? `Continue straight for ${dist}`
          : `${turnLabel(step.kind)}, then continue ${dist}`
    }

    steps.push({
      instruction: 'Arrive at your destination',
      levelId: goal.levelId,
      meters: 0,
      seconds: 0,
      kind: 'arrive',
      position: goal.position,
    })
    return steps
  }
}

function classifyTurn(angle: number): RouteStep['kind'] {
  const abs = Math.abs(angle)
  if (abs < 25) return 'straight'
  if (abs > 155) return 'u-turn'
  if (abs < 60) return angle > 0 ? 'slight-right' : 'slight-left'
  return angle > 0 ? 'right' : 'left'
}

function turnLabel(kind: RouteStep['kind']) {
  switch (kind) {
    case 'left': return 'Turn left'
    case 'right': return 'Turn right'
    case 'slight-left': return 'Bear left'
    case 'slight-right': return 'Bear right'
    case 'u-turn': return 'Turn around'
    default: return 'Continue'
  }
}

/** Binary min-heap keyed by priority. */
export class MinHeap<T> {
  private items: { value: T; priority: number }[] = []
  get size() {
    return this.items.length
  }
  push(value: T, priority: number) {
    this.items.push({ value, priority })
    let i = this.items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.items[parent].priority <= this.items[i].priority) break
      ;[this.items[parent], this.items[i]] = [this.items[i], this.items[parent]]
      i = parent
    }
  }
  pop(): T | undefined {
    if (!this.items.length) return undefined
    const top = this.items[0]
    const last = this.items.pop()!
    if (this.items.length) {
      this.items[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let smallest = i
        if (l < this.items.length && this.items[l].priority < this.items[smallest].priority) smallest = l
        if (r < this.items.length && this.items[r].priority < this.items[smallest].priority) smallest = r
        if (smallest === i) break
        ;[this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]]
        i = smallest
      }
    }
    return top.value
  }
}

/** Formats seconds as a short ETA label. */
export function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} sec`
  return `${Math.round(seconds / 60)} min`
}
