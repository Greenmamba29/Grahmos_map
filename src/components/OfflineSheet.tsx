import { useEffect, useRef, useState } from 'react'
import { Download, HardDrive, ShieldCheck, Trash2, Upload, WifiOff, X } from 'lucide-react'
import type { Venue } from '../indoor/types'
import { storage } from '../lib/storage'

interface OfflineSheetProps {
  venues: Venue[]
  activeId: string
  offlineReady: boolean
  online: boolean
  onSelect: (id: string) => void
  onImport: (file: File) => void
  onExport: () => void
  onDelete: (id: string) => void
  onClose: () => void
}

function formatBytes(bytes?: number) {
  if (!bytes) return '0 MB'
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function OfflineSheet(props: OfflineSheetProps) {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void storage.estimate().then(setEstimate)
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null))
  }, [])

  return (
    <section className="sheet tall" aria-label="Offline maps">
      <div className="sheet-handle" aria-hidden="true" />
      <header className="sheet-header">
        <div>
          <h2>Offline maps</h2>
          <p className="muted">Everything here works with no internet connection.</p>
        </div>
        <button type="button" className="icon-button" aria-label="Close offline panel" onClick={props.onClose}>
          <X size={20} />
        </button>
      </header>

      <ul className="status-list">
        <li>
          {props.offlineReady ? <ShieldCheck size={18} className="ok" /> : <WifiOff size={18} />}
          <span>{props.offlineReady ? 'App installed for offline use' : 'Caching app for offline use…'}</span>
        </li>
        <li>
          <WifiOff size={18} />
          <span>{props.online ? 'Online — not required' : 'No connection — running fully offline'}</span>
        </li>
        <li>
          <HardDrive size={18} />
          <span>
            {formatBytes(estimate?.usage)} used of {formatBytes(estimate?.quota)}
            {persisted === false && (
              <button type="button" className="link-button" onClick={() => void storage.persist().then(setPersisted)}>
                Protect from eviction
              </button>
            )}
            {persisted && ' · protected'}
          </span>
        </li>
      </ul>

      <h3>Venues on this device</h3>
      <ul className="venue-list">
        {props.venues.map((venue) => (
          <li key={venue.id} className={venue.id === props.activeId ? 'active' : ''}>
            <button type="button" className="venue-main" onClick={() => props.onSelect(venue.id)}>
              <strong>{venue.name}</strong>
              <small>
                {venue.levels.length} levels · {venue.spaces.length} spaces · {venue.beacons.length} beacons · v{venue.version}
              </small>
            </button>
            {venue.id !== 'grahmos-civic-center' && (
              <button type="button" className="icon-button" aria-label={`Delete ${venue.name}`} onClick={() => props.onDelete(venue.id)}>
                <Trash2 size={17} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="action-row">
        <button type="button" className="secondary-action" onClick={() => fileInput.current?.click()}>
          <Upload size={17} /> Import venue
        </button>
        <button type="button" className="secondary-action" onClick={props.onExport}>
          <Download size={17} /> Export current
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json,application/zip,.zip,.imdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) props.onImport(file)
          e.target.value = ''
        }}
      />
      <p className="hint">
        Import a <code>grahmos.venue/1</code> package, or an IMDF archive (.zip) exported from indoor-mapping tools: units,
        doors, levels and amenities are converted and a walking graph is generated. Share maps device-to-device from the
        Mesh panel.
      </p>
    </section>
  )
}
