interface RangeSliderProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}

/** Single-thumb range slider styled after Google Maps' price filter. */
export function RangeSlider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  format = (v) => String(v),
}: RangeSliderProps) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        className="rm-range w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        style={{ ["--fill" as string]: `${fill}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="mt-1 flex justify-between text-[11px] text-ink-soft">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
