import { describe, expect, it } from 'vitest'
import { createDemoVenue } from '../indoor/demoVenue'
import type { BeaconSighting } from './engine'
import { NativeBeaconScanner, type NativeBle } from './nativeScanner'

const venue = createDemoVenue()
const beacon = venue.beacons.find((b) => b.id === 'L2-b3')!

function fakeBle() {
  let callback: Parameters<NativeBle['requestLEScan']>[1] | null = null
  const calls: string[] = []
  const ble: NativeBle = {
    initialize: async (o) => void calls.push(`init:${o?.androidNeverForLocation}`),
    requestLEScan: async (_o, cb) => {
      callback = cb
      calls.push('scan')
    },
    stopLEScan: async () => void calls.push('stop'),
  }
  return { ble, calls, emit: (r: Parameters<NativeBle['requestLEScan']>[1] extends (x: infer R) => void ? R : never) => callback?.(r) }
}

function iBeaconFrame(uuid: string, major: number, minor: number, tx: number) {
  const hex = uuid.replace(/-/g, '')
  const bytes = [0x02, 0x15, ...hex.match(/../g)!.map((h) => parseInt(h, 16)), major >> 8, major & 0xff, minor >> 8, minor & 0xff, tx & 0xff]
  return new DataView(new Uint8Array(bytes).buffer)
}

function eddystoneFrame(namespace: string, instance: string, txAt0m: number) {
  const bytes = [0x00, txAt0m & 0xff, ...(namespace + instance).match(/../g)!.map((h) => parseInt(h, 16)), 0, 0]
  return new DataView(new Uint8Array(bytes).buffer)
}

describe('NativeBeaconScanner (Capacitor BLE)', () => {
  it('resolves Android iBeacon advertisements keyed by decimal company id', async () => {
    const { ble, calls, emit } = fakeBle()
    const seen: BeaconSighting[] = []
    const scanner = new NativeBeaconScanner(venue.beacons, ble)
    await scanner.start((s) => seen.push(s))
    emit({ rssi: -70, manufacturerData: { '76': iBeaconFrame(beacon.ibeacon!.uuid, beacon.ibeacon!.major, beacon.ibeacon!.minor, -59) } })
    expect(seen.map((s) => s.beaconId)).toEqual(['L2-b3'])
    expect(calls).toEqual(['init:false', 'scan'])
    scanner.stop()
    expect(calls.at(-1)).toBe('stop')
  })

  it('resolves Eddystone-UID service data (how iPhones see the demo beacons)', async () => {
    const { ble, emit } = fakeBle()
    const seen: BeaconSighting[] = []
    await new NativeBeaconScanner(venue.beacons, ble).start((s) => seen.push(s))
    emit({ rssi: -66, serviceData: { '0000feaa-0000-1000-8000-00805f9b34fb': eddystoneFrame(beacon.eddystone!.namespace, beacon.eddystone!.instance, -18) } })
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ beaconId: 'L2-b3', rssi: -66, txPower: -59 })
  })

  it('ignores unknown beacons and results without RSSI', async () => {
    const { ble, emit } = fakeBle()
    const seen: BeaconSighting[] = []
    await new NativeBeaconScanner(venue.beacons, ble).start((s) => seen.push(s))
    emit({ rssi: -60, manufacturerData: { '76': iBeaconFrame('00000000-0000-0000-0000-000000000000', 1, 1, -59) } })
    emit({ manufacturerData: { '76': iBeaconFrame(beacon.ibeacon!.uuid, 3, 3, -59) } })
    emit({ rssi: 127, manufacturerData: { '76': iBeaconFrame(beacon.ibeacon!.uuid, beacon.ibeacon!.major, beacon.ibeacon!.minor, -59) } })
    expect(seen).toHaveLength(0)
  })

  it('gives every demo beacon both identities', () => {
    expect(venue.beacons.every((b) => b.ibeacon && b.eddystone?.namespace.length === 20 && b.eddystone.instance.length === 12)).toBe(true)
    expect(new Set(venue.beacons.map((b) => b.eddystone!.instance)).size).toBe(venue.beacons.length)
  })
})
