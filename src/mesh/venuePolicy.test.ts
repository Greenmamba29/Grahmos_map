import { describe, expect, it } from 'vitest'
import { decideVenueUpdate } from './venuePolicy'

const builtIn = new Set(['grahmos-civic-center'])

describe('decideVenueUpdate', () => {
  it('never lets a peer replace the built-in venue', () => {
    expect(decideVenueUpdate({ id: 'grahmos-civic-center', version: 99 }, 'p1', undefined, builtIn)).toEqual({ accept: false, reason: 'built-in' })
  })
  it('installs a venue this device has never seen', () => {
    expect(decideVenueUpdate({ id: 'mall', version: 1 }, 'p1', undefined, builtIn).accept).toBe(true)
  })
  it('accepts a newer version only from the original publisher', () => {
    const known = { version: 1, publisher: 'p1' }
    expect(decideVenueUpdate({ id: 'mall', version: 2 }, 'p1', known, builtIn)).toEqual({ accept: true, reason: 'update' })
    expect(decideVenueUpdate({ id: 'mall', version: 2 }, 'p2', known, builtIn)).toEqual({ accept: false, reason: 'not-publisher' })
  })
  it('refuses mesh updates to maps imported from a file', () => {
    expect(decideVenueUpdate({ id: 'mall', version: 5 }, 'p1', { version: 1, publisher: 'local' }, builtIn).reason).toBe('not-publisher')
  })
  it('ignores same or older versions', () => {
    expect(decideVenueUpdate({ id: 'mall', version: 1 }, 'p1', { version: 1, publisher: 'p1' }, builtIn).reason).toBe('not-newer')
  })
})
