import type { ReactNode } from 'react'
import { Route } from 'lucide-react'

export function RoutesScreen() {
  return (
    <Placeholder
      icon={<Route className="h-8 w-8 text-primary" />}
      title="Routes"
      body="Terrain-aware directions with elevation profile and unverified-route alerts. Scaffolded per INSTALLATION_GUIDE §1.5."
    />
  )
}

export function SavedScreen() {
  return (
    <Placeholder
      title="Saved"
      body="Bookmarked facilities and routes for quick offline access."
    />
  )
}

export function OfflineScreen() {
  return (
    <Placeholder
      title="Offline"
      body="Download regions for offline use with bounding-box selector and live size estimate. See INSTALLATION_GUIDE §1.6."
    />
  )
}

export function AlertsScreen() {
  return (
    <Placeholder
      title="Alerts"
      body="Connectivity and facility status alerts for your area."
    />
  )
}

function Placeholder({
  title,
  body,
  icon,
}: {
  title: string
  body: string
  icon?: ReactNode
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[linear-gradient(180deg,#E8EEF4_0%,#F8FAFC_45%,#FFFFFF_100%)] px-8 text-center">
      {icon}
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      <p className="max-w-sm text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  )
}
