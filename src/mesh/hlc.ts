/**
 * Hybrid Logical Clock. Timestamps order causally across devices whose
 * wall clocks drift (common when phones have been offline for days), and
 * serialise to strings that sort lexicographically.
 */
export interface HlcTimestamp {
  wall: number
  counter: number
  node: string
}

export class HybridLogicalClock {
  private wall = 0
  private counter = 0

  constructor(
    readonly node: string,
    private readonly now: () => number = () => Date.now(),
    /** Reject remote clocks further than this in the future (ms). */
    private readonly maxDrift = 24 * 60 * 60 * 1000,
  ) {}

  tick(): string {
    const physical = this.now()
    if (physical > this.wall) {
      this.wall = physical
      this.counter = 0
    } else {
      this.counter++
    }
    return encodeHlc({ wall: this.wall, counter: this.counter, node: this.node })
  }

  /** Merges a remote timestamp; returns false when it is implausibly far ahead. */
  receive(remote: string): boolean {
    const r = decodeHlc(remote)
    if (!r) return false
    const physical = this.now()
    if (r.wall - physical > this.maxDrift) return false
    const wall = Math.max(this.wall, r.wall, physical)
    if (wall === this.wall && wall === r.wall) this.counter = Math.max(this.counter, r.counter) + 1
    else if (wall === this.wall) this.counter++
    else if (wall === r.wall) this.counter = r.counter + 1
    else this.counter = 0
    this.wall = wall
    return true
  }
}

export function encodeHlc({ wall, counter, node }: HlcTimestamp) {
  return `${wall.toString(36).padStart(10, '0')}:${counter.toString(36).padStart(4, '0')}:${node}`
}

export function decodeHlc(value: string): HlcTimestamp | null {
  const [wall, counter, ...node] = value.split(':')
  if (!wall || !counter || !node.length) return null
  const w = parseInt(wall, 36)
  const c = parseInt(counter, 36)
  if (!Number.isFinite(w) || !Number.isFinite(c)) return null
  return { wall: w, counter: c, node: node.join(':') }
}

export function hlcWall(value: string) {
  return decodeHlc(value)?.wall ?? 0
}
