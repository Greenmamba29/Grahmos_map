import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { MeshNode } from '../mesh/node'
import { fromHex, generateKey, keyFromSecret, toHex, type DeviceKey } from '../mesh/identity'
import { isNativeShell } from '../platform/native'
import { BroadcastChannelTransport } from '../mesh/transports/broadcastChannel'
import { BleClient } from '@capacitor-community/bluetooth-le'
import { BluetoothRelayTransport } from '../mesh/transports/bluetoothGatt'
import { NativeBluetoothRelayTransport } from '../mesh/transports/nativeRelay'
import { RtcLinkManager } from '../mesh/transports/webrtc'
import { PeerBleTransport } from '../mesh/transports/peerBle'
import { GrahmosBleMesh } from '../platform/bleMesh'
import { storage } from '../lib/storage'

export interface Identity {
  key: DeviceKey
  name: string
}

const NAME_KEY = 'grahmos.callsign'
const SECRET_KEY = 'grahmos.secretKey'
const TRUST_KEY = 'grahmos.trusted'

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

const session = () => (typeof sessionStorage === 'undefined' ? undefined : sessionStorage)
const local = () => (typeof localStorage === 'undefined' ? undefined : localStorage)

/**
 * Ed25519 identity. In a browser each tab is its own mesh node, so its key lives in sessionStorage; the
 * native app has one WebView, so its key persists in localStorage across launches. The callsign is
 * per device either way. The secret never leaves the device: only the public key and signatures travel.
 */
export function loadIdentity(): Identity {
  const store = isNativeShell() ? local() : session()
  let key: DeviceKey | null = null
  const saved = read(store, SECRET_KEY)
  if (saved) {
    try {
      key = keyFromSecret(fromHex(saved))
    } catch {
      key = null
    }
  }
  if (!key) {
    key = generateKey()
    write(store, SECRET_KEY, toHex(key.secretKey))
  }
  const name = read(local(), NAME_KEY) ?? `Responder ${key.peerId.slice(0, 4).toUpperCase()}`
  return { key, name }
}

export function saveIdentity(name: string) {
  write(local(), NAME_KEY, name)
}

function loadTrusted(): string[] {
  try {
    const parsed = JSON.parse(read(local(), TRUST_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function useMesh(venueId: string, onVenue: (venue: unknown, from: string) => void) {
  const [node] = useState(() => {
    const identity = loadIdentity()
    return new MeshNode({ key: identity.key, name: identity.name, venueId, trusted: loadTrusted() })
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
    // Native shells: phones link to each other directly over Bluetooth (no relay needed).
    let phones: PeerBleTransport | null = null
    if (isNativeShell()) {
      phones = new PeerBleTransport(GrahmosBleMesh)
      node.addTransport(phones)
      void phones.start().catch(() => {})
    }
    // Upgrade neighbours to direct WebRTC links (fast LAN path for venue maps); signalling rides the mesh.
    const rtc = typeof RTCPeerConnection === 'undefined' ? null : new RtcLinkManager(node)
    const interval = setInterval(() => {
      node.sync()
      rtc?.connectAll()
    }, 15_000)
    return () => {
      cancelled = true
      clearInterval(interval)
      rtc?.close()
      if (phones) node.removeTransport(phones)
      node.removeTransport(tabs)
    }
  }, [node])

  // Persist CRDT state whenever it changes.
  useEffect(() => {
    const timeout = setTimeout(() => {
      void storage.saveAnnotations(node.signedEntries())
      write(local(), TRUST_KEY, JSON.stringify([...node.trusted]))
    }, 400)
    return () => clearTimeout(timeout)
  }, [node, revision])

  const connectBluetooth = useCallback(async () => {
    setError(null)
    const transport = isNativeShell()
      ? new NativeBluetoothRelayTransport(BleClient)
      : new BluetoothRelayTransport({ namePrefix: 'GrahmOS' })
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
      saveIdentity(trimmed)
    },
    [node],
  )

  return {
    node,
    revision,
    error,
    connectBluetooth,
    rename,
    bluetoothSupported: isNativeShell() || BluetoothRelayTransport.isSupported(),
  }
}
