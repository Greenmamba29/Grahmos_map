import { CloudOff, HardDrive, WifiOff } from 'lucide-react';
import { formatRelativeTime } from '@/lib/format';
import type { DataSource } from '@/types';

interface OfflineBannerProps {
  online: boolean;
  source: DataSource;
  fetchedAt?: string;
}

/**
 * Data-freshness banner.
 *
 * Being offline is the normal case for this app, so the banner reports *how old*
 * the data is rather than simply warning that the network is gone — stale facility
 * status is the actual risk to a responder.
 */
export function OfflineBanner({ online, source, fetchedAt }: OfflineBannerProps) {
  if (online && source === 'network') return null;

  const { icon: Icon, text, tone } = describe(online, source, fetchedAt);

  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2 shadow-[var(--shadow-map)]"
    >
      <Icon size={15} strokeWidth={2.2} style={{ color: tone }} className="shrink-0" />
      <span className="truncate text-[12.5px] leading-tight text-ink">{text}</span>
    </div>
  );
}

function describe(online: boolean, source: DataSource, fetchedAt?: string) {
  if (!online) {
    return {
      icon: WifiOff,
      tone: '#d93025',
      text:
        source === 'cache'
          ? `Offline — showing data saved ${formatRelativeTime(fetchedAt)}`
          : 'Offline — showing the bundled facility list',
    };
  }
  if (source === 'cache') {
    return {
      icon: CloudOff,
      tone: '#f9ab00',
      text: `Server unreachable — data from ${formatRelativeTime(fetchedAt)}`,
    };
  }
  return {
    icon: HardDrive,
    tone: '#5f6368',
    text: 'Demo data — connect a Supabase project for live status',
  };
}
