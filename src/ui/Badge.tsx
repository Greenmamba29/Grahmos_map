import type { ReactNode } from "react";

export function Badge({
  children,
  color = "#1A73E8",
  bg = "#E8F0FE",
}: {
  children: ReactNode;
  color?: string;
  bg?: string;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ color, backgroundColor: bg }}
    >
      {children}
    </span>
  );
}
