/**
 * Last-writer-wins map CRDT keyed by HLC timestamps. Every device can edit
 * offline; when two devices meet (directly or via relays) they converge to
 * the same state regardless of message order or duplication.
 */
export interface LwwEntry<T> {
  key: string
  value: T
  hlc: string
}

export type Digest = Record<string, string>

/** `E` lets callers store richer entries (e.g. signed ones) and get them back typed. */
export class LwwMap<T, E extends LwwEntry<T> = LwwEntry<T>> {
  private readonly entries = new Map<string, E>()

  constructor(initial: E[] = []) {
    for (const entry of initial) this.merge(entry)
  }

  /** Applies an entry; returns true when local state changed. */
  merge(entry: E): boolean {
    const current = this.entries.get(entry.key)
    if (current && current.hlc >= entry.hlc) return false
    this.entries.set(entry.key, entry)
    return true
  }

  get(key: string) {
    return this.entries.get(key)?.value
  }

  values(): T[] {
    return [...this.entries.values()].map((e) => e.value)
  }

  all(): E[] {
    return [...this.entries.values()]
  }

  digest(): Digest {
    const out: Digest = {}
    for (const [key, entry] of this.entries) out[key] = entry.hlc
    return out
  }

  /** Entries the remote is missing or holds an older version of. */
  newerThan(remote: Digest): E[] {
    return this.all().filter((e) => !remote[e.key] || remote[e.key] < e.hlc)
  }

  /** True when the remote digest contains something newer than we have. */
  remoteHasNewer(remote: Digest): boolean {
    return Object.entries(remote).some(([key, hlc]) => {
      const mine = this.entries.get(key)
      return !mine || mine.hlc < hlc
    })
  }

  delete(predicate: (entry: E) => boolean) {
    for (const [key, entry] of this.entries) if (predicate(entry)) this.entries.delete(key)
  }
}
