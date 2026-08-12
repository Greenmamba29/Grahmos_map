import { Bookmark, Megaphone, Navigation, Phone } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatPhoneHref } from '@/lib/format';
import type { Facility } from '@/types';

interface ActionPillsProps {
  facility: Facility;
  saved: boolean;
  onDirections: () => void;
  onReport: () => void;
  onSave: () => void;
}

/** Directions / Report Status / Save / Call, in place of Maps' share-and-website row. */
export function ActionPills({
  facility,
  saved,
  onDirections,
  onReport,
  onSave,
}: ActionPillsProps) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
      <button
        type="button"
        onClick={onDirections}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-primary-dark"
      >
        <Navigation size={16} strokeWidth={2.2} className="fill-white" />
        Directions
      </button>

      <Pill icon={Megaphone} label="Report status" onClick={onReport} />

      <Pill
        icon={Bookmark}
        label={saved ? 'Saved' : 'Save'}
        onClick={onSave}
        active={saved}
        fillIcon={saved}
      />

      {facility.contactPhone ? (
        <a
          href={formatPhoneHref(facility.contactPhone)}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-white px-4 py-2.5 text-[14px] font-medium text-ink transition-colors hover:bg-canvas"
        >
          <Phone size={16} strokeWidth={2.2} />
          Call
        </a>
      ) : (
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-white px-4 py-2.5 text-[14px] font-medium text-ink-muted/70">
          <Phone size={16} strokeWidth={2.2} />
          No number
        </span>
      )}
    </div>
  );
}

interface PillProps {
  icon: typeof Bookmark;
  label: string;
  onClick: () => void;
  active?: boolean;
  fillIcon?: boolean;
}

function Pill({ icon: Icon, label, onClick, active = false, fillIcon = false }: PillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2.5 text-[14px] font-medium transition-colors',
        active
          ? 'border-primary bg-primary-soft text-primary-dark'
          : 'border-hairline bg-white text-ink hover:bg-canvas',
      )}
    >
      <Icon size={16} strokeWidth={2.2} className={fillIcon ? 'fill-current' : undefined} />
      {label}
    </button>
  );
}
