import { WifiOff } from "lucide-react";
import { useIsOnline } from "./NetworkStatusProvider";

export function OfflineBanner() {
  const isOnline = useIsOnline();
  if (isOnline) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-3 pt-3">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-elevated">
        <WifiOff size={16} className="text-white" />
        Offline — showing cached data
      </div>
    </div>
  );
}
