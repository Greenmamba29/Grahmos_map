import { describe, expect, it } from 'vitest'
import { manifestVersion, precacheEntries } from './precache'

describe('precacheEntries', () => {
  it('lists every emitted file once, sorted, with content revisions', () => {
    const entries = precacheEntries([
      { path: 'assets/b.js', content: 'b' },
      { path: 'index.html', content: '<html>' },
      { path: 'assets/b.js', content: 'b' },
      { path: 'icons/map-icon.svg', content: new Uint8Array([1, 2]) },
    ])
    expect(entries.map((e) => e.url)).toEqual(['/assets/b.js', '/icons/map-icon.svg', '/index.html'])
    expect(entries.every((e) => /^[0-9a-f]{16}$/.test(e.revision))).toBe(true)
  })

  it('skips source maps, the worker itself and oversized files', () => {
    const big = new Uint8Array(6 * 1024 * 1024)
    const entries = precacheEntries([
      { path: 'assets/a.js.map', content: '{}' },
      { path: 'service-worker.js', content: 'sw' },
      { path: 'assets/huge.bin', content: big },
      { path: 'assets/a.js', content: 'a' },
    ])
    expect(entries.map((e) => e.url)).toEqual(['/assets/a.js'])
  })

  it('changes the cache version when any file changes, so old caches are dropped', () => {
    const v1 = manifestVersion(precacheEntries([{ path: 'index.html', content: 'v1' }]))
    const v2 = manifestVersion(precacheEntries([{ path: 'index.html', content: 'v2' }]))
    expect(v1).not.toBe(v2)
  })
})
