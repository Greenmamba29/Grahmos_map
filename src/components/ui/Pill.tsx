import type { ReactNode } from "react";

interface PillProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

/** Pill-style toggle used in the filter sheet and category chips. */
export function Pill({ active, onClick, children, className = "" }: PillProps) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary-soft text-primary"
          : "border-line bg-white text-ink-soft hover:bg-gray-50"
      } ${className}`}
    >
      {children}
    </button>
  );
}
