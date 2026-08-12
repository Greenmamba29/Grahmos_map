import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { Icon } from "../ui/Icon";

/** Slim banner shown while the device has no connectivity. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="z-30 flex items-center justify-center gap-2 bg-ink px-4 py-1.5 text-xs font-medium text-white">
      <Icon name="download" size={14} />
      Offline — showing downloaded maps and facility data
    </div>
  );
}
