import type { Point } from './types'

export function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

export function centroid(polygon: Point[]): Point {
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < polygon.length; i++) {
    const [x0, y0] = polygon[i]
    const [x1, y1] = polygon[(i + 1) % polygon.length]
    const cross = x0 * y1 - x1 * y0
    area += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }
  if (Math.abs(area) < 1e-9) {
    const sx = polygon.reduce((s, p) => s + p[0], 0)
    const sy = polygon.reduce((s, p) => s + p[1], 0)
    return [sx / polygon.length, sy / polygon.length]
  }
  area /= 2
  return [cx / (6 * area), cy / (6 * area)]
}

export function pointInPolygon([x, y]: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

export interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function bbox(points: Point[]): BBox {
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const [x, y] of points) {
    box.minX = Math.min(box.minX, x)
    box.minY = Math.min(box.minY, y)
    box.maxX = Math.max(box.maxX, x)
    box.maxY = Math.max(box.maxY, y)
  }
  return box
}

export function rect(x: number, y: number, w: number, h: number): Point[] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
}

/** Signed turn angle in degrees from heading a→b to heading b→c (y-down: + is right). */
export function turnAngle(a: Point, b: Point, c: Point): number {
  const h1 = Math.atan2(b[1] - a[1], b[0] - a[0])
  const h2 = Math.atan2(c[1] - b[1], c[0] - b[0])
  let delta = ((h2 - h1) * 180) / Math.PI
  while (delta > 180) delta -= 360
  while (delta < -180) delta += 360
  return delta
}

/** Converts local metres to WGS84 using an equirectangular approximation. */
export function localToLngLat(
  [x, y]: Point,
  anchor: { lng: number; lat: number; bearing: number },
): [number, number] {
  const theta = (anchor.bearing * Math.PI) / 180
  const east = x * Math.cos(theta) - y * Math.sin(theta)
  const north = -(x * Math.sin(theta) + y * Math.cos(theta))
  const metersPerDegLat = 111_320
  const metersPerDegLng = 111_320 * Math.cos((anchor.lat * Math.PI) / 180)
  return [anchor.lng + east / metersPerDegLng, anchor.lat + north / metersPerDegLat]
}
