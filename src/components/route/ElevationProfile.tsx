import { useMemo, useState } from 'react';
import { formatDistance, formatElevation } from '@/lib/format';
import type { ElevationSample } from '@/types';

interface ElevationProfileProps {
  samples: ElevationSample[];
  /** Called as the responder scrubs, so the map can show the matching point. */
  onScrub?: (sample: ElevationSample | null) => void;
  height?: number;
}

const WIDTH = 320;
const PAD = 4;

/**
 * Terrain profile for the planned route.
 *
 * This is the chart that decides whether a route is actually usable: a 6 km detour
 * on the flat beats a 3 km climb over a ridge for a loaded truck. Hazard-affected
 * stretches are shaded so a blocked climb is obvious at a glance.
 */
export function ElevationProfile({ samples, onScrub, height = 96 }: ElevationProfileProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (samples.length < 2) return null;

    const totalDistance = samples[samples.length - 1].distanceM || 1;
    const elevations = samples.map((sample) => sample.elevationM);
    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    const span = Math.max(20, maxElevation - minElevation);

    const points = samples.map((sample) => {
      const x = PAD + (sample.distanceM / totalDistance) * (WIDTH - PAD * 2);
      const y =
        height - PAD - ((sample.elevationM - minElevation) / span) * (height - PAD * 2);
      return { x, y, sample };
    });

    const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    const area = `${PAD},${height} ${line} ${(WIDTH - PAD).toFixed(1)},${height}`;

    // Contiguous runs of hazard-affected samples become shaded bands.
    const bands: Array<{ x: number; width: number; severity: number }> = [];
    let runStart: number | null = null;
    let runSeverity = 0;
    points.forEach((point, index) => {
      const severity = point.sample.hazardSeverity ?? 0;
      if (severity > 0 && runStart === null) {
        runStart = point.x;
        runSeverity = severity;
      } else if (severity > 0) {
        runSeverity = Math.max(runSeverity, severity);
      } else if (runStart !== null) {
        bands.push({ x: runStart, width: Math.max(2, point.x - runStart), severity: runSeverity });
        runStart = null;
        runSeverity = 0;
      }
      if (index === points.length - 1 && runStart !== null) {
        bands.push({ x: runStart, width: Math.max(2, point.x - runStart), severity: runSeverity });
      }
    });

    return { points, line, area, minElevation, maxElevation, totalDistance, bands };
  }, [samples, height]);

  if (!geometry) {
    return (
      <p className="rounded-2xl bg-canvas px-4 py-6 text-center text-[13.5px] text-ink-muted">
        No elevation data for this route.
      </p>
    );
  }

  const active = hoverIndex !== null ? geometry.points[hoverIndex] : null;

  return (
    <div className="rounded-2xl border border-hairline p-3">
      <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
        <span className="font-medium text-ink">Terrain profile</span>
        <span className="text-ink-muted">
          {active
            ? `${formatDistance(active.sample.distanceM)} · ${formatElevation(active.sample.elevationM)}`
            : `${formatElevation(geometry.minElevation)} – ${formatElevation(geometry.maxElevation)}`}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Elevation profile from ${formatElevation(geometry.minElevation)} to ${formatElevation(geometry.maxElevation)}`}
        className="h-24 w-full touch-none"
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
          const index = Math.min(
            geometry.points.length - 1,
            Math.max(0, Math.round(ratio * (geometry.points.length - 1))),
          );
          setHoverIndex(index);
          onScrub?.(geometry.points[index].sample);
        }}
        onPointerLeave={() => {
          setHoverIndex(null);
          onScrub?.(null);
        }}
      >
        <defs>
          <linearGradient id="elevation-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a73e8" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#1a73e8" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {geometry.bands.map((band, index) => (
          <rect
            key={`${band.x}-${index}`}
            x={band.x}
            y={0}
            width={band.width}
            height={height}
            fill={band.severity >= 4 ? '#d93025' : '#f9ab00'}
            opacity={0.14}
          />
        ))}

        <polygon points={geometry.area} fill="url(#elevation-fill)" />
        <polyline
          points={geometry.line}
          fill="none"
          stroke="#1a73e8"
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {active && (
          <>
            <line
              x1={active.x}
              y1={0}
              x2={active.x}
              y2={height}
              stroke="#5f6368"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={active.x} cy={active.y} r={3.5} fill="#1a73e8" stroke="#fff" strokeWidth={2} />
          </>
        )}
      </svg>

      <div className="mt-1 flex justify-between text-[11.5px] text-ink-muted">
        <span>Start</span>
        <span>{formatDistance(geometry.totalDistance)}</span>
      </div>
    </div>
  );
}
