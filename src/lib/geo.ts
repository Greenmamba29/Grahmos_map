import { twMerge } from 'tailwind-merge'
import clsx, { type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function haversineM(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number,
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Rough offline pack size estimate from bbox + zoom range (vector tiles). */
export function estimateRegionSizeMb(
  west: number,
  south: number,
  east: number,
  north: number,
  minZoom: number,
  maxZoom: number,
): number {
  const width = Math.max(0.001, east - west)
  const height = Math.max(0.001, north - south)
  const area = width * height
  let tiles = 0
  for (let z = minZoom; z <= maxZoom; z++) {
    const worldTiles = 4 ** z
    tiles += Math.ceil(worldTiles * (area / 360 / 180))
  }
  // ~2.5 KB average for sparse vector tiles
  return Math.max(0.1, (tiles * 2.5) / 1024)
}
