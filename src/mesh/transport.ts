export type LinkStatus = 'idle' | 'connecting' | 'up' | 'down' | 'error'

/**
 * A link a mesh node can speak over. Transports move opaque text frames;
 * the node handles dedupe, relaying, CRDT sync and chunk-free semantics.
 */
export abstract class MeshTransport {
  abstract readonly id: string
  abstract readonly label: string
  status: LinkStatus = 'idle'
  detail?: string
  onFrame: (frame: string) => void = () => {}
  onStatusChange: () => void = () => {}
  /** Fired when a link becomes usable, so the node can say hello and sync. */
  onLinkUp: () => void = () => {}

  abstract start(): Promise<void>
  abstract stop(): void
  abstract send(frame: string): void

  protected setStatus(status: LinkStatus, detail?: string) {
    const wasUp = this.status === 'up'
    this.status = status
    this.detail = detail
    this.onStatusChange()
    if (status === 'up' && !wasUp) this.onLinkUp()
  }
}
