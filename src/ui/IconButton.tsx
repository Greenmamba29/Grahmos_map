import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "surface" | "accent" | "ghost";
}

const sizeClasses: Record<NonNullable<IconButtonProps["size"]>, string> = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14",
};

const variantClasses: Record<NonNullable<IconButtonProps["variant"]>, string> = {
  surface: "bg-white text-ink shadow-floating hover:bg-black/[0.03]",
  accent: "bg-accent text-white shadow-elevated hover:bg-accent-dark",
  ghost: "bg-transparent text-ink hover:bg-black/5",
};

export function IconButton({
  icon,
  size = "md",
  variant = "surface",
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={clsx(
        "flex items-center justify-center rounded-full transition-colors duration-150",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
