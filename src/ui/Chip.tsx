import type { ReactNode } from "react";
import clsx from "clsx";

interface ChipProps {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  color?: string;
  onClick?: () => void;
  className?: string;
}

export function Chip({ label, icon, active, color, onClick, className }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium shadow-floating transition-colors duration-150",
        active
          ? "border-transparent bg-accent text-white"
          : "border-black/5 bg-white text-ink hover:bg-black/[0.03]",
        className,
      )}
      style={
        active && color
          ? { backgroundColor: color, borderColor: color }
          : undefined
      }
    >
      {icon}
      {label}
    </button>
  );
}
