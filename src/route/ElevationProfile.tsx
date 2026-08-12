import { useMemo, useState } from "react";
import type { ElevationPoint } from "./mockRouting";

export function ElevationProfile({ data }: { data: ElevationPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 320;
  const height = 88;
  const padding = 8;

  const { path, points, minEl, maxEl } = useMemo(() => {
    const elevations = data.map((d) => d.elevationM);
    const minEl = Math.min(...elevations);
    const maxEl = Math.max(...elevations);
    const range = Math.max(1, maxEl - minEl);

    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
      const y =
        height - padding - ((d.elevationM - minEl) / range) * (height - padding * 2);
      return { x, y, ...d };
    });

    const path = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");

    return { path, points, minEl, maxEl };
  }, [data]);

  const areaPath = `${path} L ${points[points.length - 1]?.x ?? 0} ${height - padding} L ${points[0]?.x ?? 0} ${height - padding} Z`;
  const active = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="relative">
      <div className="mb-1 flex items-center justify-between text-xs font-medium text-ink-faint">
        <span>Elevation profile</span>
        <span>
          {minEl}–{maxEl} m
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * width;
          const idx = Math.round(((relX - padding) / (width - padding * 2)) * (points.length - 1));
          setHoverIndex(Math.min(Math.max(idx, 0), points.length - 1));
        }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="elevation-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1A73E8" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#1A73E8" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#elevation-fill)" />
        <path d={path} fill="none" stroke="#1A73E8" strokeWidth={2} />
        {active && (
          <g>
            <line x1={active.x} x2={active.x} y1={0} y2={height} stroke="#1A73E8" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={active.x} cy={active.y} r={4} fill="#1A73E8" />
          </g>
        )}
      </svg>
      {active && (
        <div className="pointer-events-none absolute -top-1 rounded-md bg-ink px-2 py-1 text-xs font-medium text-white" style={{ left: `${(active.x / width) * 100}%`, transform: "translate(-50%, -100%)" }}>
          {active.elevationM} m @ {active.distanceKm} km
        </div>
      )}
    </div>
  );
}
