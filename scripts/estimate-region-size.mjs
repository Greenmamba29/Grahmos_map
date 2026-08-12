#!/usr/bin/env node
/**
 * CLI helper: rough offline pack size estimate for a bbox + zoom range.
 * Usage: node scripts/estimate-region-size.mjs --west=-105.15 --south=39.55 --east=-104.7 --north=39.85 --min=0 --max=14
 */

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? Number(hit.split('=')[1]) : fallback
}

const west = arg('west', -105.15)
const south = arg('south', 39.55)
const east = arg('east', -104.7)
const north = arg('north', 39.85)
const minZoom = arg('min', 0)
const maxZoom = arg('max', 14)

const width = Math.max(0.001, east - west)
const height = Math.max(0.001, north - south)
const area = width * height
let tiles = 0
for (let z = minZoom; z <= maxZoom; z++) {
  tiles += Math.ceil(4 ** z * (area / 360 / 180))
}
const mb = Math.max(0.1, (tiles * 2.5) / 1024)

console.log(
  JSON.stringify(
    { west, south, east, north, minZoom, maxZoom, tiles, sizeMb: Number(mb.toFixed(2)) },
    null,
    2,
  ),
)
