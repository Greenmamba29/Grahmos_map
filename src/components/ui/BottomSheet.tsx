import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type SheetSnap = 'peek' | 'half' | 'full';

const SNAP_HEIGHT: Record<SheetSnap, string> = {
  peek: '148px',
  half: '55vh',
  full: '92vh',
};

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  snap?: SheetSnap;
  onSnapChange?: (snap: SheetSnap) => void;
  /** Snap points the drag handle cycles through. */
  snapPoints?: SheetSnap[];
  showScrim?: boolean;
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * The Maps bottom sheet: rounded top corners, a drag handle that cycles snap
 * points, and a scrim on the larger snaps. Drag is pointer-based so it works with
 * touch, pen and mouse without a gesture library.
 */
export function BottomSheet({
  open,
  onClose,
  snap = 'half',
  onSnapChange,
  snapPoints = ['peek', 'half', 'full'],
  showScrim = true,
  label,
  children,
  className,
}: BottomSheetProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const commitDrag = useCallback(
    (delta: number) => {
      const index = snapPoints.indexOf(snap);
      if (delta < -60 && index < snapPoints.length - 1) {
        onSnapChange?.(snapPoints[index + 1]);
      } else if (delta > 60) {
        if (index > 0) onSnapChange?.(snapPoints[index - 1]);
        else onClose();
      }
      setDragOffset(0);
      setDragging(false);
      dragStart.current = null;
    },
    [snap, snapPoints, onSnapChange, onClose],
  );

  const cycleSnap = useCallback(() => {
    const index = snapPoints.indexOf(snap);
    onSnapChange?.(snapPoints[(index + 1) % snapPoints.length]);
  }, [snap, snapPoints, onSnapChange]);

  return (
    <>
      {showScrim && open && snap !== 'peek' && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/20 transition-opacity"
        />
      )}

      <section
        role="dialog"
        aria-modal={snap === 'full'}
        aria-label={label}
        style={{
          height: SNAP_HEIGHT[snap],
          transform: open
            ? `translateY(${Math.max(0, dragOffset)}px)`
            : 'translateY(110%)',
          transition: dragging ? 'none' : 'transform 260ms var(--ease-sheet)',
        }}
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-3xl bg-white shadow-[var(--shadow-sheet)]',
          'md:inset-y-0 md:left-0 md:right-auto md:h-full md:w-[400px] md:rounded-t-none md:rounded-r-3xl',
          className,
        )}
      >
        <div
          role="separator"
          aria-label="Resize sheet"
          onPointerDown={(event) => {
            dragStart.current = event.clientY;
            setDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragStart.current === null) return;
            setDragOffset(event.clientY - dragStart.current);
          }}
          onPointerUp={(event) => {
            if (dragStart.current === null) return;
            commitDrag(event.clientY - dragStart.current);
          }}
          onPointerCancel={() => {
            setDragOffset(0);
            setDragging(false);
            dragStart.current = null;
          }}
          className="flex shrink-0 cursor-grab touch-none justify-center py-3 active:cursor-grabbing md:hidden"
        >
          <button
            type="button"
            aria-label="Expand or collapse sheet"
            onClick={cycleSnap}
            className="h-1 w-9 rounded-full bg-hairline"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-safe">{children}</div>
      </section>
    </>
  );
}
