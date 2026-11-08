import { describe, expect, it } from 'vitest'
import { createDemoVenue } from './demoVenue'
import { editDistance, searchPlaces, venuePlaces } from './search'

const places = venuePlaces(createDemoVenue())

describe('searchPlaces', () => {
  it('matches names by prefix', () => {
    expect(searchPlaces(places, 'cafe')[0].place.name).toBe('Cafe Meridian')
  })

  it('understands synonyms', () => {
    expect(searchPlaces(places, 'bathroom')[0].place.category).toBe('restroom')
    expect(searchPlaces(places, 'defibrillator')[0].place.category).toBe('aed')
    expect(searchPlaces(places, 'way out').every((h) => h.place.category === 'exit')).toBe(true)
  })

  it('tolerates typos', () => {
    expect(searchPlaces(places, 'libary')[0].place.name).toBe('Library')
  })

  it('returns nothing for empty queries', () => {
    expect(searchPlaces(places, '  ')).toEqual([])
  })
})

describe('editDistance', () => {
  it('computes small distances', () => {
    expect(editDistance('kitten', 'sitten')).toBe(1)
    expect(editDistance('abc', 'abc')).toBe(0)
  })
})
