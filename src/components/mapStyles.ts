import {
  AlertTriangle,
  Ban,
  BatteryCharging,
  DoorOpen,
  Droplets,
  FireExtinguisher,
  HeartPulse,
  Info,
  Siren,
  StickyNote,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { AmenityCategory, SpaceCategory } from '../indoor/types'
import type { AnnotationType } from '../mesh/protocol'

export const spaceFill: Record<SpaceCategory, string> = {
  room: '#f1f3f4',
  corridor: '#ffffff',
  lobby: '#e8f0fe',
  restroom: '#e0f2f1',
  elevator: '#ede7f6',
  stairs: '#ede7f6',
  food: '#fff3e0',
  medical: '#fce8e6',
  retail: '#fef7e0',
  office: '#f3f6fa',
  conference: '#e6f4ea',
  utility: '#eceff1',
  security: '#e8eaf6',
  shelter: '#e6f4ea',
}

export const amenityStyle: Record<AmenityCategory, { icon: LucideIcon; color: string }> = {
  exit: { icon: DoorOpen, color: '#188038' },
  aed: { icon: HeartPulse, color: '#d93025' },
  'first-aid': { icon: HeartPulse, color: '#d93025' },
  'fire-extinguisher': { icon: FireExtinguisher, color: '#c5221f' },
  information: { icon: Info, color: '#1a73e8' },
  water: { icon: Droplets, color: '#1967d2' },
  charging: { icon: BatteryCharging, color: '#e37400' },
  assembly: { icon: Users, color: '#188038' },
}

export const annotationStyle: Record<AnnotationType, { icon: LucideIcon; color: string; label: string }> = {
  closure: { icon: Ban, color: '#d93025', label: 'Closure' },
  // #b06000: 4.9:1 on white for the label text (#e37400 was 3.0:1).
  hazard: { icon: AlertTriangle, color: '#b06000', label: 'Hazard' },
  sos: { icon: Siren, color: '#c5221f', label: 'SOS' },
  note: { icon: StickyNote, color: '#5f6368', label: 'Note' },
  'all-clear': { icon: Info, color: '#188038', label: 'All clear' },
}

