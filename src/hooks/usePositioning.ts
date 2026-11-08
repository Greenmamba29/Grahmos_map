import { useCallback, useEffect, useRef, useState } from 'react'
import type { IndoorPosition, Point, Venue } from '../indoor/types'
import { PositioningEngine } from '../positioning/engine'
import { BleClient } from '@capacitor-community/bluetooth-le'
import { isNativeShell } from '../platform/native'
import { NativeBeaconScanner } from '../positioning/nativeScanner'
import { headingFromOrientation, StepDetector, stepDisplacement } from '../positioning/pdr'
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
  const motionCleanup = useRef<(() => void) | null>(null)
  const [steps, setSteps] = useState(0)

  const stop = useCallback(() => {
    scanner.current?.stop()
    scanner.current = null
    if (loop.current) clearInterval(loop.current)
    loop.current = null
    motionCleanup.current?.()
    motionCleanup.current = null
    setWalkProgress(null)
  }, [])

  /** Real phone sensors: accelerometer steps + OS-fused compass heading, fused into the engine. */
  const startMotion = useCallback(() => {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return
    const detector = new StepDetector()
    let heading: number | null = null
    const onOrientation = (e: DeviceOrientationEvent) => {
      heading = headingFromOrientation(e as DeviceOrientationEvent & { webkitCompassHeading?: number }) ?? heading
    }
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity
      if (!a || a.x === null || a.y === null || a.z === null) return
      const step = detector.push(a.x, a.y, a.z, e.timeStamp)
      if (!step || heading === null) return
      const [dx, dy] = stepDisplacement(heading, step.length, venue.anchor?.bearing ?? 0)
      const p = engine.current?.applyStep(dx, dy, Date.now())
      if (p) {
        setPosition(p)
        setSteps((n) => n + 1)
      }
    }
    window.addEventListener('devicemotion', onMotion)
    window.addEventListener('deviceorientationabsolute' as 'deviceorientation', onOrientation)
    window.addEventListener('deviceorientation', onOrientation)
    motionCleanup.current = () => {
      window.removeEventListener('devicemotion', onMotion)
      window.removeEventListener('deviceorientationabsolute' as 'deviceorientation', onOrientation)
      window.removeEventListener('deviceorientation', onOrientation)
    }
  }, [venue.anchor?.bearing])

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

  const startBluetooth = useCallback(async () => {
    // iOS gates motion sensors behind a permission prompt that must come from this user gesture.
    const DME = (typeof window !== 'undefined' ? window.DeviceMotionEvent : undefined) as
      | (typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> })
      | undefined
    await DME?.requestPermission?.().catch(() => 'denied')
    await run(
      isNativeShell() ? new NativeBeaconScanner(venue.beacons, BleClient) : new WebBluetoothBeaconScanner(venue.beacons),
      'ble',
    )
    startMotion()
  }, [run, venue.beacons, startMotion])

  /** Walks a simulated person along `path`, generating noisy BLE sightings. */
  const startSimulatedWalk = useCallback(
    (path: WalkPoint[]) => {
      if (!path.length) return
      const startedAt = Date.now()
      const total = pathLength(path)
      const where = () => pointAlong(path, ((Date.now() - startedAt) / 1000) * DEMO_WALK_SPEED)
      // Simulated PDR: one step per 0.75 m travelled, along the true direction with a little heading noise.
      let last = where()
      let pending = 0
      return run(new SimulatedBeaconScanner(venue.beacons, where), 'simulated', () => {
        const travelled = ((Date.now() - startedAt) / 1000) * DEMO_WALK_SPEED
        setWalkProgress(Math.min(1, travelled / Math.max(total, 1)))
        const now = where()
        if (now && last && now.levelId === last.levelId) {
          pending += Math.hypot(now.position[0] - last.position[0], now.position[1] - last.position[1])
          const heading = (Math.atan2(now.position[0] - last.position[0], -(now.position[1] - last.position[1])) * 180) / Math.PI
          while (pending >= 0.75) {
            pending -= 0.75
            const [dx, dy] = stepDisplacement(heading + (Math.random() - 0.5) * 8, 0.75)
            if (engine.current?.applyStep(dx, dy, Date.now())) setSteps((n) => n + 1)
          }
        }
        last = now
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
    steps,
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
