import { useState } from 'react'
import { Bluetooth, CheckCircle2, MessageSquare, MonitorSmartphone, Send, Share2, X } from 'lucide-react'
import type { Level } from '../indoor/types'
import type { MeshNode } from '../mesh/node'
import type { AnnotationType } from '../mesh/protocol'
import { annotationStyle } from './mapStyles'

interface MeshSheetProps {
  node: MeshNode
  levels: Level[]
  bluetoothSupported: boolean
  error: string | null
  onConnectBluetooth: () => void
  onRename: (name: string) => void
  onReport: (type: AnnotationType) => void
  onShareVenue: () => void
  onFocus: (levelId: string, position: [number, number]) => void
  onClose: () => void
}

function ago(at: number) {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  return `${Math.round(s / 3600)}h ago`
}

export function MeshSheet(props: MeshSheetProps) {
  const { node, levels } = props
  const [name, setName] = useState(node.name)
  const [text, setText] = useState('')
  const peers = node.activePeers()
  const annotations = node.activeAnnotations().sort((a, b) => b.createdAt - a.createdAt)
  const links = node.links()
  const levelName = (id?: string) => levels.find((l) => l.id === id)?.name ?? '—'

  return (
    <section className="sheet tall" aria-label="Mesh network">
      <div className="sheet-handle" aria-hidden="true" />
      <header className="sheet-header">
        <div>
          <h2>Offline mesh</h2>
          <p className="muted">
            {peers.length} peer{peers.length === 1 ? '' : 's'} · {node.stats.received} received · {node.stats.relayed} relayed
          </p>
        </div>
        <button type="button" className="icon-button" aria-label="Close mesh panel" onClick={props.onClose}>
          <X size={20} />
        </button>
      </header>

      <div className="report-grid" aria-label="Report to everyone nearby">
        {(['sos', 'closure', 'hazard', 'note'] as AnnotationType[]).map((type) => {
          const { icon: Icon, color, label } = annotationStyle[type]
          return (
            <button key={type} type="button" onClick={() => props.onReport(type)} style={{ '--accent': color } as React.CSSProperties}>
              <Icon size={20} />
              {label}
            </button>
          )
        })}
      </div>

      <h3>Links</h3>
      <ul className="link-list">
        {links.map((link) => (
          <li key={link.id}>
            {link.id.startsWith('ble') ? <Bluetooth size={17} /> : <MonitorSmartphone size={17} />}
            <span>{link.label}</span>
            <span className={`status ${link.status}`}>{link.detail ?? link.status}</span>
          </li>
        ))}
      </ul>
      <div className="action-row">
        <button type="button" className="secondary-action" onClick={props.onConnectBluetooth} disabled={!props.bluetoothSupported}>
          <Bluetooth size={17} /> Connect relay node
        </button>
        <button type="button" className="secondary-action" onClick={props.onShareVenue}>
          <Share2 size={17} /> Share map
        </button>
      </div>
      {!props.bluetoothSupported && (
        <p className="hint">Web Bluetooth isn't available in this browser. Use Chrome or Edge on Android or desktop, or the native shell.</p>
      )}
      {props.error && <p className="problem">{props.error}</p>}

      <h3>Shared reports</h3>
      {annotations.length === 0 && <p className="hint">No active reports. Anything you report reaches every device in range, even hop by hop.</p>}
      <ul className="annotation-list">
        {annotations.map((a) => {
          const { icon: Icon, color, label } = annotationStyle[a.type]
          return (
            <li key={a.id}>
              <button type="button" className="annotation-main" onClick={() => props.onFocus(a.levelId, a.position)}>
                <span className="badge" style={{ background: color }}>
                  <Icon size={14} color="#fff" />
                </span>
                <span>
                  <strong>{label}: {a.text || 'No details'}</strong>
                  <small>
                    {levelName(a.levelId)} · {a.authorName} · {ago(a.createdAt)}
                  </small>
                </span>
              </button>
              <button type="button" className="icon-button" aria-label={`Mark ${label} resolved`} onClick={() => node.resolveAnnotation(a.id)}>
                <CheckCircle2 size={18} />
              </button>
            </li>
          )
        })}
      </ul>

      <h3>People nearby</h3>
      {peers.length === 0 && <p className="hint">Open the app in another tab, or connect a relay node, to see peers.</p>}
      <ul className="peer-list">
        {peers.map((p) => (
          <li key={p.peerId}>
            <span className="peer-dot" />
            <span>
              <strong>{p.name}</strong>
              <small>{p.levelId ? levelName(p.levelId) : 'Location not shared'} · {ago(p.at)}</small>
            </span>
          </li>
        ))}
      </ul>

      <h3>
        <MessageSquare size={15} /> Broadcast messages
      </h3>
      <ul className="message-list">
        {node.messages.slice(-8).map((m) => (
          <li key={m.id}>
            <strong>{m.from === node.peerId ? 'You' : m.fromName}</strong> {m.text}
            <small> · {m.hops} hop{m.hops === 1 ? '' : 's'}</small>
          </li>
        ))}
      </ul>
      <form
        className="message-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          node.sendText(text.trim())
          setText('')
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message everyone in range" aria-label="Broadcast message" />
        <button type="submit" className="icon-button" aria-label="Send message">
          <Send size={18} />
        </button>
      </form>

      <form
        className="identity-form"
        onSubmit={(e) => {
          e.preventDefault()
          props.onRename(name)
        }}
      >
        <label>
          Your callsign
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </label>
        <button type="submit" className="secondary-action">Save</button>
      </form>
    </section>
  )
}
