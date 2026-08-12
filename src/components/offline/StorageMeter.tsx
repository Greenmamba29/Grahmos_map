import { formatBytes } from '@/lib/format';

interface StorageMeterProps {
  usage: number;
  quota: number;
}

export function StorageMeter({ usage, quota }: StorageMeterProps) {
  if (quota <= 0) {
    return (
      <p className="text-[12.5px] text-ink-muted">
        This browser does not report a storage quota.
      </p>
    );
  }

  const ratio = Math.min(1, usage / quota);
  const color = ratio > 0.9 ? '#d93025' : ratio > 0.75 ? '#f9ab00' : '#1a73e8';

  return (
    <div>
      <div className="flex items-baseline justify-between text-[12.5px]">
        <span className="text-ink-muted">Device storage used</span>
        <span className="font-medium text-ink">
          {formatBytes(usage)} of {formatBytes(quota)}
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-canvas"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={quota}
        aria-valuenow={usage}
        aria-label="Device storage used"
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
