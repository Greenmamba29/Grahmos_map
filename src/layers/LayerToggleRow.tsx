import type { ReactNode } from "react";

interface LayerToggleRowProps {
  icon: ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  disabledHint?: string;
}

export function LayerToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
  disabled,
  disabledHint,
}: LayerToggleRowProps) {
  return (
    <label
      className={`flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors ${
        disabled ? "opacity-50" : "hover:bg-black/[0.03]"
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {(description || (disabled && disabledHint)) && (
          <span className="block text-xs text-ink-muted">
            {disabled && disabledHint ? disabledHint : description}
          </span>
        )}
      </span>
      <span className="relative inline-flex h-6 w-10 shrink-0 items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="absolute inset-0 rounded-full bg-black/15 transition-colors peer-checked:bg-accent" />
        <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}
