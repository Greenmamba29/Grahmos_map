import { centroid } from './geometry'
import type { Point, Venue } from './types'

export type PlaceKind = 'space' | 'amenity'

export interface Place {
  id: string
  kind: PlaceKind
  name: string
  category: string
  levelId: string
  position: Point
  nodeId?: string
  keywords: string[]
}

export interface SearchHit {
  place: Place
  score: number
}

/** Common words people use, mapped onto venue categories. */
const SYNONYMS: Record<string, string[]> = {
  restroom: ['bathroom', 'toilet', 'wc', 'washroom', 'loo', 'restrooms'],
  exit: ['way out', 'leave', 'door', 'evacuate', 'entrance'],
  aed: ['defibrillator', 'heart', 'cardiac'],
  medical: ['doctor', 'nurse', 'hospital', 'clinic', 'first aid', 'injury'],
  'first-aid': ['bandage', 'kit', 'injury'],
  food: ['eat', 'coffee', 'cafe', 'meal', 'kitchen', 'snack'],
  elevator: ['lift', 'wheelchair'],
  stairs: ['stairway', 'staircase', 'steps'],
  shelter: ['sleep', 'cots', 'refuge', 'bed'],
  water: ['drink', 'fountain', 'refill'],
  charging: ['power', 'battery', 'charge', 'outlet'],
  information: ['help', 'info', 'desk', 'reception'],
  'fire-extinguisher': ['fire', 'extinguisher'],
  conference: ['meeting', 'room'],
}

export function venuePlaces(venue: Venue): Place[] {
  const places: Place[] = []
  for (const space of venue.spaces) {
    if (space.category === 'corridor') continue
    places.push({
      id: space.id,
      kind: 'space',
      name: space.name,
      category: space.category,
      levelId: space.levelId,
      position: centroid(space.polygon),
      nodeId: space.entranceNodeId,
      keywords: [...(space.keywords ?? []), ...(SYNONYMS[space.category] ?? [])],
    })
  }
  for (const amenity of venue.amenities) {
    places.push({
      id: amenity.id,
      kind: 'amenity',
      name: amenity.name,
      category: amenity.category,
      levelId: amenity.levelId,
      position: amenity.position,
      nodeId: amenity.nodeId,
      keywords: [...(amenity.keywords ?? []), ...(SYNONYMS[amenity.category] ?? [])],
    })
  }
  return places
}

export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Damerau-free Levenshtein distance with an early exit above `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      rowMin = Math.min(rowMin, row[j])
    }
    if (rowMin > max) return max + 1
    prev = row
  }
  return prev[b.length]
}

function tokenScore(queryToken: string, words: string[]): number {
  let best = 0
  for (const word of words) {
    if (word === queryToken) return 1
    if (word.startsWith(queryToken)) best = Math.max(best, 0.8)
    else if (queryToken.length >= 3 && word.includes(queryToken)) best = Math.max(best, 0.5)
    else if (queryToken.length >= 4 && editDistance(queryToken, word, 1) <= 1) {
      best = Math.max(best, 0.6)
    }
  }
  return best
}

/** Offline fuzzy search across rooms and amenities. */
export function searchPlaces(places: Place[], query: string, limit = 12): SearchHit[] {
  const q = normalize(query)
  if (!q) return []
  const tokens = q.split(' ')
  const hits: SearchHit[] = []
  for (const place of places) {
    const name = normalize(place.name)
    const nameWords = name.split(' ')
    const keywordWords = place.keywords.flatMap((k) => normalize(k).split(' '))
    const categoryWords = normalize(place.category).split(' ')
    let score = 0
    let matched = 0
    for (const token of tokens) {
      const s = Math.max(
        tokenScore(token, nameWords) * 1.0,
        tokenScore(token, categoryWords) * 0.8,
        tokenScore(token, keywordWords) * 0.7,
      )
      if (s > 0) matched++
      score += s
    }
    if (matched < tokens.length) continue
    if (name.startsWith(q)) score += 1
    else if (name.includes(q)) score += 0.5
    hits.push({ place, score })
  }
  return hits
    .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name))
    .slice(0, limit)
}
