import type { ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Tailwind max-height class for the sheet body. */
  heightClass?: string;
  title?: string;
}

/** Google-Maps-style slide-up sheet with grabber, backdrop and rounded top. */
export function BottomSheet({
  open,
  onClose,
  children,
  heightClass = "max-h-[82dvh]",
  title,
}: BottomSheetProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/30 animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-xl rounded-t-2xl bg-white shadow-[var(--shadow-sheet)] animate-sheet-up ${heightClass} flex flex-col`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-center pt-2.5 pb-1 shrink-0">
          <div className="h-1 w-9 rounded-full bg-line" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-5 pb-2 shrink-0">
            <h2 className="text-lg font-medium">{title}</h2>
            <button
              onClick={onClose}
              className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-line/60"
              aria-label="Close sheet"
            >
              <CloseGlyph />
            </button>
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain grow">{children}</div>
      </div>
    </div>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor">
      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  );
}
