import { Navigation, Flag, Bookmark, Phone } from "lucide-react";
import clsx from "clsx";

interface ActionPillRowProps {
  onDirections: () => void;
  onReportStatus: () => void;
  onSave: () => void;
  onCall: () => void;
  saved?: boolean;
  hasPhone?: boolean;
}

export function ActionPillRow({
  onDirections,
  onReportStatus,
  onSave,
  onCall,
  saved,
  hasPhone,
}: ActionPillRowProps) {
  const actions = [
    { label: "Directions", icon: Navigation, onClick: onDirections, primary: true },
    { label: "Report Status", icon: Flag, onClick: onReportStatus },
    { label: saved ? "Saved" : "Save", icon: Bookmark, onClick: onSave, active: saved },
    { label: "Call", icon: Phone, onClick: onCall, disabled: !hasPhone },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {actions.map(({ label, icon: Icon, onClick, primary, active, disabled }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={clsx(
            "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            primary
              ? "bg-accent text-white hover:bg-accent-dark"
              : active
              ? "bg-accent-soft text-accent"
              : "bg-black/[0.05] text-ink hover:bg-black/[0.08]",
          )}
        >
          <Icon size={16} fill={active ? "currentColor" : "none"} />
          {label}
        </button>
      ))}
    </div>
  );
}
