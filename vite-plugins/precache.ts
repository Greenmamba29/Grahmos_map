import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { build, type Plugin } from 'vite'

/**
 * Offline precache without workbox-build. vite-plugin-pwa → workbox-build pulled in deepmerge (an advisory
 * with no fixed version), an old glob and a minimatch 5 copy, all to inject one asset list. This plugin
 * hashes every emitted file plus public/, then bundles src/service-worker.ts with that list inlined.
 */
export interface PrecacheEntry {
  url: string
  revision: string
}

const MAX_BYTES = 5 * 1024 * 1024

export function revision(content: string | Uint8Array) {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

/** Sorted, deduplicated manifest; skips source maps, oversized files and the worker itself. */
export function precacheEntries(files: { path: string; content: string | Uint8Array }[]): PrecacheEntry[] {
  const seen = new Map<string, PrecacheEntry>()
  for (const { path, content } of files) {
    const url = `/${path.split(sep).join('/').replace(/^\/+/, '')}`
    if (url.endsWith('.map') || url === '/service-worker.js' || url.endsWith('.DS_Store')) continue
    if (content.length > MAX_BYTES) continue
    seen.set(url, { url, revision: revision(content) })
  }
  return [...seen.values()].sort((a, b) => a.url.localeCompare(b.url))
}

export function manifestVersion(entries: PrecacheEntry[]) {
  return revision(entries.map((e) => `${e.url}@${e.revision}`).join('\n'))
}

function walk(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name)
      return statSync(p).isDirectory() ? walk(p) : [p]
    })
  } catch {
    return []
  }
}

export function offlinePrecache(options: { entry: string }): Plugin {
  let outDir = 'dist'
  let publicDir = 'public'
  let root = process.cwd()
  const emitted: { path: string; content: string | Uint8Array }[] = []
  return {
    name: 'grahmos-offline-precache',
    apply: 'build',
    configResolved(config) {
      root = config.root
      outDir = join(config.root, config.build.outDir)
      publicDir = config.publicDir
    },
    writeBundle(_options, bundle) {
      emitted.length = 0
      for (const item of Object.values(bundle)) {
        emitted.push({ path: item.fileName, content: item.type === 'chunk' ? item.code : item.source })
      }
    },
    async closeBundle() {
      const fromPublic = walk(publicDir).map((p) => ({ path: relative(publicDir, p), content: readFileSync(p) }))
      const entries = precacheEntries([...emitted, ...fromPublic])
      await build({
        configFile: false,
        root,
        logLevel: 'warn',
        define: {
          __PRECACHE_MANIFEST__: JSON.stringify(entries),
          __PRECACHE_VERSION__: JSON.stringify(manifestVersion(entries)),
        },
        build: {
          outDir,
          emptyOutDir: false,
          copyPublicDir: false,
          minify: true,
          rollupOptions: {
            input: join(root, options.entry),
            output: { format: 'iife', entryFileNames: 'service-worker.js' },
          },
        },
      })
      this.info?.(`precache: ${entries.length} files`)
    },
  }
}
