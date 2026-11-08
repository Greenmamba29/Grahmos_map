import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { MeshNode } from '../mesh/node'
import { randomId } from '../mesh/protocol'
import { BroadcastChannelTransport } from '../mesh/transports/broadcastChannel'
import { BluetoothRelayTransport } from '../mesh/transports/bluetoothGatt'
import { storage } from '../lib/storage'

export interface Identity {
  peerId: string
  name: string
}

const NAME_KEY = 'grahmos.callsign'
const PEER_KEY = 'grahmos.peerId'

function read(store: Storage | undefined, key: string) {
  try {
    return store?.getItem(key) ?? null
  } catch {
    return null
  }
}

function write(store: Storage | undefined, key: string, value: string) {
  try {
    store?.setItem(key, value)
  } catch {
    // storage may be disabled (private mode); identity stays in memory
  }
}

/**
 * Peer ids are per tab (sessionStorage) so two tabs on one device are two
 * distinct mesh nodes; the human-readable callsign is shared per device.
 */
export function loadIdentity(): Identity {
  const session = typeof sessionStorage === 'undefined' ? undefined : sessionStorage
  const local = typeof localStorage === 'undefined' ? undefined : localStorage
  let peerId = read(session, PEER_KEY)
  if (!peerId) {
    peerId = randomId(6)
    write(session, PEER_KEY, peerId)
  }
  const name = read(local, NAME_KEY) ?? `Responder ${peerId.slice(0, 4).toUpperCase()}`
  return { peerId, name }
}

export function saveIdentity(identity: Identity) {
  write(typeof localStorage === 'undefined' ? undefined : localStorage, NAME_KEY, identity.name)
}

export function useMesh(venueId: string, onVenue: (venue: unknown, from: string) => void) {
  const [node] = useState(() => {
    const identity = loadIdentity()
    return new MeshNode({ peerId: identity.peerId, name: identity.name, venueId })
  })
  const revision = useSyncExternalStore(
    useCallback((listener) => node.subscribe(listener), [node]),
    () => node.revision,
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    node.setVenue(venueId)
  }, [node, venueId])

  useEffect(() => {
    node.setVenueHandler(onVenue)
  }, [node, onVenue])

  // Restore replicated state, join the on-device channel, and keep syncing.
  useEffect(() => {
    let cancelled = false
    void storage.loadAnnotations().then((entries) => {
      if (cancelled) return
      node.restore(entries)
      node.sync()
    })
    const tabs = new BroadcastChannelTransport()
    node.addTransport(tabs)
    void tabs.start()
    const interval = setInterval(() => node.sync(), 15_000)
    return () => {
      cancelled = true
      clearInterval(interval)
      node.removeTransport(tabs)
    }
  }, [node])

  // Persist CRDT state whenever it changes.
  useEffect(() => {
    const timeout = setTimeout(() => void storage.saveAnnotations(node.annotations.all()), 400)
    return () => clearTimeout(timeout)
  }, [node, revision])

  const connectBluetooth = useCallback(async () => {
    setError(null)
    const transport = new BluetoothRelayTransport({ namePrefix: 'GrahmOS' })
    node.addTransport(transport)
    try {
      await transport.start()
    } catch (e) {
      node.removeTransport(transport)
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [node])

  const rename = useCallback(
    (name: string) => {
      const trimmed = name.trim().slice(0, 40)
      if (!trimmed) return
      node.setName(trimmed)
      saveIdentity({ peerId: node.peerId, name: trimmed })
    },
    [node],
  )

  return {
    node,
    revision,
    error,
    connectBluetooth,
    rename,
    bluetoothSupported: BluetoothRelayTransport.isSupported(),
  }
}
