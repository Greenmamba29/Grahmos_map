import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { IndoorRouter } from '../routing/router'
import { importImdf, ImdfImportError, type ImdfLayers } from './imdf'
import { searchPlaces, venuePlaces } from './search'

// Synthetic IMDF in real WGS84 around a point; layout given in metres (x east, y south).
const lng0 = -122.4
const lat0 = 37.79
const mLat = 111_320
const mLng = 111_320 * Math.cos((lat0 * Math.PI) / 180)
const ll = (x: number, y: number) => [lng0 + x / mLng, lat0 - y / mLat]
const rect = (x: number, y: number, w: number, h: number) => ({
  type: 'Polygon',
  coordinates: [[ll(x, y), ll(x + w, y), ll(x + w, y + h), ll(x, y + h), ll(x, y)]],
})
const door = (x1: number, y1: number, x2: number, y2: number) => ({ type: 'LineString', coordinates: [ll(x1, y1), ll(x2, y2)] })
const fc = (features: unknown[]) => ({ type: 'FeatureCollection', features })
const unit = (id: string, level: string, category: string, name: string | null, geometry: unknown) => ({
  id, type: 'Feature', feature_type: 'unit', geometry, properties: { category, level_id: level, name: name ? { en: name } : null },
})
const opening = (id: string, level: string, category: string, geometry: unknown) => ({
  id, type: 'Feature', feature_type: 'opening', geometry, properties: { category, level_id: level },
})

function sample(): ImdfLayers {
  const units = []
  const openings = []
  for (const [level, suffix] of [['lvl-0', '0'], ['lvl-1', '1']] as const) {
    units.push(
      unit(`corr-${suffix}`, level, 'walkway', 'Main Hall', rect(0, 10, 30, 4)),
      unit(`a-${suffix}`, level, suffix === '0' ? 'conferenceroom' : 'office', suffix === '0' ? 'Conference A' : 'Office A', rect(0, 0, 10, 10)),
      unit(`b-${suffix}`, level, 'restroom.female', null, rect(10, 0, 10, 10)),
      unit(`lift-${suffix}`, level, 'elevator', null, rect(20, 0, 4, 10)),
      unit(`stair-${suffix}`, level, 'stairs', null, rect(24, 0, 6, 10)),
      unit(`c-${suffix}`, level, 'foodservice', 'Cafe', rect(0, 14, 15, 10)),
      unit(`lobby-${suffix}`, level, suffix === '0' ? 'lobby' : 'opentobelow', 'Lobby', rect(15, 14, 15, 10)),
    )
    openings.push(
      opening(`d-a-${suffix}`, level, 'pedestrian', door(4, 10, 6, 10)),
      opening(`d-b-${suffix}`, level, 'pedestrian', door(14, 10, 16, 10)),
      opening(`d-lift-${suffix}`, level, 'pedestrian', door(21, 10, 23, 10)),
      opening(`d-stair-${suffix}`, level, 'pedestrian', door(26, 10, 28, 10)),
      opening(`d-c-${suffix}`, level, 'pedestrian', door(6, 14, 8, 14)),
    )
  }
  openings.push(opening('d-lobby-0', 'lvl-0', 'pedestrian', door(20, 14, 22, 14)), opening('d-main', 'lvl-0', 'pedestrian.principal', door(21, 24, 23, 24)))
  return {
    venue: fc([{ id: 'venue', type: 'Feature', feature_type: 'venue', geometry: rect(0, 0, 30, 24), properties: { name: { en: 'Harbor Library' } } }]),
    footprint: fc([{ id: 'fp', type: 'Feature', feature_type: 'footprint', geometry: rect(0, 0, 30, 24), properties: {} }]),
    level: fc([
      { id: 'lvl-0', type: 'Feature', feature_type: 'level', geometry: rect(0, 0, 30, 24), properties: { ordinal: 0, name: { en: 'Ground' }, short_name: { en: 'G' } } },
      { id: 'lvl-1', type: 'Feature', feature_type: 'level', geometry: rect(0, 0, 30, 24), properties: { ordinal: 1, name: { en: 'First' }, short_name: { en: '1' } } },
    ]),
    unit: fc(units),
    opening: fc(openings),
    amenity: fc([{ id: 'aed-1', type: 'Feature', feature_type: 'amenity', geometry: { type: 'Point', coordinates: ll(12, 12) }, properties: { category: 'defibrillator', unit_ids: ['corr-0'], name: { en: 'AED' } } }]),
  } as unknown as ImdfLayers
}

describe('importImdf', () => {
  it('imports levels, units (skipping open-to-below), amenities and a main-entrance exit', () => {
    const venue = importImdf(sample())
    expect(venue.name).toBe('Harbor Library')
    expect(venue.levels.map((l) => l.shortName)).toEqual(['G', '1'])
    expect(venue.spaces.find((s) => s.id === 'lobby-1')).toBeUndefined()
    expect(venue.spaces.find((s) => s.id === 'b-0')!.category).toBe('restroom')
    expect(venue.amenities.find((a) => a.category === 'aed')!.levelId).toBe('lvl-0')
    expect(venue.amenities.find((a) => a.category === 'exit')!.name).toBe('Main Entrance')
    // Local metres: the 30 m wide building comes out ~30 m wide.
    const xs = venue.levels[0].outline.map((p) => p[0])
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(30, 0)
  })

  it('generates a walkable graph across floors, step-free through the elevator', () => {
    const venue = importImdf(sample())
    const router = new IndoorRouter(venue)
    const route = router.route('lobby-0:node', 'a-1:node')!
    expect(route).toBeDefined()
    expect(route.nodes.at(-1)!.levelId).toBe('lvl-1')
    const stepFree = router.route('lobby-0:node', 'a-1:node', { stepFree: true })!
    expect(stepFree.legs.some((l) => l.kind === 'elevator')).toBe(true)
    expect(stepFree.legs.some((l) => l.kind === 'stairs')).toBe(false)
    expect(router.route('a-0:node', venue.amenities.find((a) => a.category === 'exit')!.nodeId!)).toBeDefined()
  })

  it('reads a zipped IMDF archive and makes it searchable', () => {
    const layers = sample() as unknown as Record<string, unknown>
    const zip = zipSync(Object.fromEntries(Object.entries(layers).map(([k, v]) => [`imdf/${k}.geojson`, strToU8(JSON.stringify(v))])))
    const venue = importImdf(zip)
    expect(searchPlaces(venuePlaces(venue), 'conference')[0].place.name).toBe('Conference A')
    expect(searchPlaces(venuePlaces(venue), 'bathroom')[0].place.category).toBe('restroom')
  })

  it('rejects archives without levels or units', () => {
    expect(() => importImdf({ unit: fc([]) } as unknown as ImdfLayers)).toThrow(ImdfImportError)
    expect(() => importImdf(new Uint8Array([1, 2, 3]))).toThrow('Not a zip')
  })
})
