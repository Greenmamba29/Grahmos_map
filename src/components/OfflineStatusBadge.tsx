import { CloudOff, DatabaseZap } from 'lucide-react';

type OfflineStatusBadgeProps = {
  downloadedRegionCount: number;
};

export function OfflineStatusBadge({ downloadedRegionCount }: OfflineStatusBadgeProps) {
  return (
    <div className="absolute left-4 top-[9.6rem] z-20 flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-bold text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.16)] ring-1 ring-slate-200 backdrop-blur">
      {downloadedRegionCount > 0 ? (
        <DatabaseZap aria-hidden="true" className="h-4 w-4 text-[#1A73E8]" />
      ) : (
        <CloudOff aria-hidden="true" className="h-4 w-4 text-amber-600" />
      )}
      {downloadedRegionCount > 0
        ? `${downloadedRegionCount} offline region${downloadedRegionCount === 1 ? '' : 's'}`
        : 'Offline demo data'}
    </div>
  );
}
