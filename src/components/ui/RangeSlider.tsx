import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/cn';

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  /** Single value, or [low, high] for a dual-thumb range. */
  value: number | [number, number];
  onChange: (value: number | [number, number]) => void;
  label: string;
  formatValue?: (value: number) => string;
}

/**
 * Dual-thumb slider built on pointer events rather than stacked native inputs, so
 * the track and thumbs can carry the Maps styling and still expose proper ARIA
 * slider semantics with keyboard support.
 */
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  label,
  formatValue = (n) => String(n),
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dual = Array.isArray(value);
  const low = dual ? value[0] : min;
  const high = dual ? value[1] : value;

  const toPercent = (n: number) => ((n - min) / (max - min)) * 100;

  const quantize = useCallback(
    (raw: number) => {
      const clamped = Math.min(max, Math.max(min, raw));
      return Math.round(clamped / step) * step;
    },
    [min, max, step],
  );

  const valueFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return min;
      const rect = track.getBoundingClientRect();
      const ratio = (clientX - rect.left) / Math.max(1, rect.width);
      return quantize(min + ratio * (max - min));
    },
    [min, max, quantize],
  );

  const emit = useCallback(
    (thumb: 'low' | 'high', next: number) => {
      if (!dual) {
        onChange(next);
        return;
      }
      if (thumb === 'low') onChange([Math.min(next, high), high]);
      else onChange([low, Math.max(next, low)]);
    },
    [dual, high, low, onChange],
  );

  const startDrag = (thumb: 'low' | 'high') => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) => emit(thumb, valueFromClientX(moveEvent.clientX));
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };

  const onKeyDown = (thumb: 'low' | 'high') => (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = thumb === 'low' ? low : high;
    const bump = event.shiftKey ? step * 10 : step;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      emit(thumb, quantize(current - bump));
      event.preventDefault();
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      emit(thumb, quantize(current + bump));
      event.preventDefault();
    } else if (event.key === 'Home') {
      emit(thumb, min);
    } else if (event.key === 'End') {
      emit(thumb, max);
    }
  };

  const thumbClass =
    'absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-primary bg-white shadow-[var(--shadow-pill)] active:cursor-grabbing';

  return (
    <div className="select-none">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[15px] font-medium text-ink">{label}</span>
        <span className="text-[14px] text-ink-muted">
          {dual ? `${formatValue(low)} – ${formatValue(high)}` : formatValue(high)}
        </span>
      </div>

      <div
        ref={trackRef}
        onPointerDown={(event) => {
          const next = valueFromClientX(event.clientX);
          if (!dual) {
            emit('high', next);
            return;
          }
          const closest = Math.abs(next - low) <= Math.abs(next - high) ? 'low' : 'high';
          emit(closest, next);
        }}
        className="relative h-10 cursor-pointer"
      >
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-hairline" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
          style={{
            left: `${dual ? toPercent(low) : 0}%`,
            width: `${toPercent(high) - (dual ? toPercent(low) : 0)}%`,
          }}
        />

        {dual && (
          <div
            role="slider"
            tabIndex={0}
            aria-label={`${label} minimum`}
            aria-valuemin={min}
            aria-valuemax={high}
            aria-valuenow={low}
            aria-valuetext={formatValue(low)}
            onPointerDown={startDrag('low')}
            onKeyDown={onKeyDown('low')}
            style={{ left: `${toPercent(low)}%` }}
            className={cn(thumbClass, 'z-10')}
          />
        )}

        <div
          role="slider"
          tabIndex={0}
          aria-label={dual ? `${label} maximum` : label}
          aria-valuemin={dual ? low : min}
          aria-valuemax={max}
          aria-valuenow={high}
          aria-valuetext={formatValue(high)}
          onPointerDown={startDrag('high')}
          onKeyDown={onKeyDown('high')}
          style={{ left: `${toPercent(high)}%` }}
          className={cn(thumbClass, 'z-10')}
        />
      </div>
    </div>
  );
}
