/**
 * Who may install or replace a venue map received over the mesh. Envelopes are signed, so `from` is a
 * verified peer id; this decides what that peer is allowed to change.
 */
export type VenueDecision =
  | { accept: true; reason: 'new' | 'update' }
  | { accept: false; reason: 'built-in' | 'not-newer' | 'not-publisher' }

export interface KnownVenue {
  version: number
  /** Peer id that first shared it over the mesh; 'local' for built-in or file imports. */
  publisher: string
}

export function decideVenueUpdate(
  incoming: { id: string; version: number },
  from: string,
  known: KnownVenue | undefined,
  builtInIds: ReadonlySet<string>,
): VenueDecision {
  if (builtInIds.has(incoming.id)) return { accept: false, reason: 'built-in' }
  if (!known) return { accept: true, reason: 'new' }
  if (incoming.version <= known.version) return { accept: false, reason: 'not-newer' }
  if (known.publisher !== from) return { accept: false, reason: 'not-publisher' }
  return { accept: true, reason: 'update' }
}
