import type { LucideIcon } from 'lucide-react';
import { Switch } from '@/components/ui/Switch';

interface ToggleRowProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  iconColor?: string;
  disabled?: boolean;
}

export function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
  iconColor,
  disabled,
}: ToggleRowProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-canvas"
        style={iconColor ? { color: iconColor } : undefined}
      >
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink">{label}</span>
        {description && (
          <span className="block truncate text-[13px] text-ink-muted">{description}</span>
        )}
      </span>
      <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}
