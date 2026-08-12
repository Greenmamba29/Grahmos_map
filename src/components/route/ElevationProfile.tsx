import { useMemo } from "react";

interface Props {
  /** Elevation samples in meters, evenly spaced along the route. */
  elevation: number[];
  distanceM: number;
}

/**
 * SVG elevation/terrain profile. Segments steeper than ~15% grade are
 * highlighted amber — the terrain-aware cue for routing around hazards.
 */
export function ElevationProfile({ elevation, distanceM }: Props) {
  const W = 320;
  const H = 90;
  const PAD = 6;

  const { areaPath, linePath, steepSegments, min, max } = useMemo(() => {
    const lo = Math.min(...elevation);
    const hi = Math.max(...elevation);
    const span = Math.max(hi - lo, 10);
    const stepM = distanceM / (elevation.length - 1);

    const pts = elevation.map((e, i) => {
      const x = PAD + (i / (elevation.length - 1)) * (W - 2 * PAD);
      const y = H - PAD - ((e - lo) / span) * (H - 2 * PAD);
      return [x, y] as const;
    });

    const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const area = `${line} L${(W - PAD).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`;

    const steep: string[] = [];
    for (let i = 1; i < elevation.length; i++) {
      const grade = Math.abs(elevation[i] - elevation[i - 1]) / Math.max(stepM, 1);
      if (grade > 0.15) {
        const [x1, y1] = pts[i - 1];
        const [x2, y2] = pts[i];
        steep.push(`M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`);
      }
    }
    return { areaPath: area, linePath: line, steepSegments: steep, min: lo, max: hi };
  }, [elevation, distanceM]);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Elevation profile">
        <path d={areaPath} fill="#e8f0fe" />
        <path d={linePath} fill="none" stroke="#1a73e8" strokeWidth={2} strokeLinejoin="round" />
        {steepSegments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#f29900" strokeWidth={3.5} strokeLinecap="round" />
        ))}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#e8eaed" />
      </svg>
      <div className="flex justify-between text-[11px] text-ink-soft">
        <span>{min} m</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1 w-4 rounded bg-warn" /> steep &gt; 15%
        </span>
        <span>{max} m</span>
      </div>
    </div>
  );
}
