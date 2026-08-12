import { CheckCircle2, Database, WifiOff } from 'lucide-react'

interface StatusBannerProps {
  online: boolean
  source: 'demo' | 'cache' | 'live'
}

export function StatusBanner({ online, source }: StatusBannerProps) {
  if (online && source === 'live') {
    return (
      <div className="status-banner live" role="status">
        <CheckCircle2 size={15} />
        Live facility status
      </div>
    )
  }

  return (
    <div className="status-banner" role="status">
      {online ? <Database size={15} /> : <WifiOff size={15} />}
      <span>
        {source === 'cache'
          ? 'Using downloaded facility data'
          : online
            ? 'Preview data · connect Supabase for live status'
            : 'Offline · showing available map data'}
      </span>
    </div>
  )
}
