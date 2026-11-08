import { useCallback, useEffect, useRef, useState } from 'react'
import type { IndoorPosition, Point, Venue } from '../indoor/types'
import { PositioningEngine } from '../positioning/engine'
import { BleClient } from '@capacitor-community/bluetooth-le'
import { isNativeShell } from '../platform/native'
import { NativeBeaconScanner } from '../positioning/nativeScanner'
import {
  SimulatedBeaconScanner,
  WebBluetoothBeaconScanner,
  pointAlong,
  type BeaconScanner,
  type WalkPoint,
} from '../positioning/scanners'

export type PositioningMode = 'off' | 'ble' | 'simulated' | 'manual'

const DEMO_WALK_SPEED = 2.6 // metres per second (2× walking pace for demos)

export function usePositioning(venue: Venue) {
  const [position, setPosition] = useState<IndoorPosition | null>(null)
  const [mode, setMode] = useState<PositioningMode>('off')
  const [error, setError] = useState<string | null>(null)
  const [walkProgress, setWalkProgress] = useState<number | null>(null)
  const engine = useRef<PositioningEngine | null>(null)
  const scanner = useRef<BeaconScanner | null>(null)
  const loop = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    scanner.current?.stop()
    scanner.current = null
    if (loop.current) clearInterval(loop.current)
    loop.current = null
    setWalkProgress(null)
  }, [])

  useEffect(() => stop, [stop])

  const run = useCallback(
    async (next: BeaconScanner, label: PositioningMode, tick?: () => void) => {
      stop()
      setError(null)
      engine.current = new PositioningEngine(venue.beacons)
      scanner.current = next
      try {
        await next.start((s) => engine.current?.ingest(s))
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setMode('off')
        scanner.current = null
        return
      }
      setMode(label)
      loop.current = setInterval(() => {
        tick?.()
        const estimate = engine.current?.estimate(Date.now())
        if (estimate) setPosition({ ...estimate, source: label === 'simulated' ? 'simulated' : 'ble' })
      }, 400)
    },
    [venue.beacons, stop],
  )

  const startBluetooth = useCallback(
    () =>
      run(
        isNativeShell() ? new NativeBeaconScanner(venue.beacons, BleClient) : new WebBluetoothBeaconScanner(venue.beacons),
        'ble',
      ),
    [run, venue.beacons],
  )

  /** Walks a simulated person along `path`, generating noisy BLE sightings. */
  const startSimulatedWalk = useCallback(
    (path: WalkPoint[]) => {
      if (!path.length) return
      const startedAt = Date.now()
      const total = pathLength(path)
      const where = () => pointAlong(path, ((Date.now() - startedAt) / 1000) * DEMO_WALK_SPEED)
      return run(new SimulatedBeaconScanner(venue.beacons, where), 'simulated', () => {
        const travelled = ((Date.now() - startedAt) / 1000) * DEMO_WALK_SPEED
        setWalkProgress(Math.min(1, travelled / Math.max(total, 1)))
        if (travelled > total + 8) stop()
      })
    },
    [run, venue.beacons, stop],
  )

  const setManual = useCallback(
    (levelId: string, point: Point) => {
      stop()
      setMode('manual')
      setPosition({ levelId, position: point, accuracy: 1.5, source: 'manual', at: Date.now() })
    },
    [stop],
  )

  const turnOff = useCallback(() => {
    stop()
    setMode('off')
    setPosition(null)
  }, [stop])

  return {
    position,
    mode,
    error,
    walkProgress,
    startBluetooth,
    startSimulatedWalk,
    setManual,
    turnOff,
    bluetoothScanSupported: isNativeShell() || WebBluetoothBeaconScanner.isSupported(),
  }
}

function pathLength(path: WalkPoint[]) {
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    total += a.levelId === b.levelId ? Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1]) : 6
  }
  return total
}
