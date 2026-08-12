import type { ReactNode } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  /** anchors as a right-side drawer on wide viewports (used by LayersDrawer) */
  anchorRightOnDesktop?: boolean;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
  anchorRightOnDesktop,
}: BottomSheetProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40">
      <div
        className="absolute inset-0 bg-black/30 animate-fade-in"
        onClick={onClose}
      />
      <div
        className={clsx(
          "absolute inset-x-0 bottom-0 max-h-[80%] overflow-y-auto rounded-t-3xl bg-white p-4 pb-6 shadow-sheet animate-slide-up",
          anchorRightOnDesktop &&
            "sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:w-[380px] sm:max-h-none sm:rounded-t-none sm:rounded-l-3xl",
          className,
        )}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-black/10 sm:hidden" />
        {title && (
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-black/5"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
