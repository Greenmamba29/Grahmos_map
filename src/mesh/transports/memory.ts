import { MeshTransport } from '../transport'

/**
 * Point-to-point in-memory link. Used by tests and the topology simulator to
 * prove multi-hop relaying (A ↔ B ↔ C with no direct A ↔ C link).
 */
export class MemoryTransport extends MeshTransport {
  readonly label: string
  peer: MemoryTransport | null = null
  /** Probability [0, 1) that a frame is silently lost, to model lossy radio. */
  lossRate = 0
  private random: () => number = Math.random
  delivered = 0

  constructor(readonly id: string) {
    super()
    this.label = `Memory link ${id}`
  }

  static pair(a: string, b: string): [MemoryTransport, MemoryTransport] {
    const left = new MemoryTransport(a)
    const right = new MemoryTransport(b)
    left.peer = right
    right.peer = left
    return [left, right]
  }

  withLoss(rate: number, random: () => number) {
    this.lossRate = rate
    this.random = random
    return this
  }

  async start() {
    this.setStatus('up')
  }

  stop() {
    this.setStatus('down')
  }

  send(frame: string) {
    const peer = this.peer
    if (!peer || peer.status !== 'up') return
    if (this.lossRate > 0 && this.random() < this.lossRate) return
    this.delivered++
    peer.onFrame(frame)
  }
}
