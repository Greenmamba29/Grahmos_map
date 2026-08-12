import { useEffect, useState } from "react";

export function StorageUsageBar() {
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);

  useEffect(() => {
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then((estimate) => {
        setUsage({ used: estimate.usage ?? 0, quota: estimate.quota ?? 0 });
      });
    }
  }, []);

  if (!usage || usage.quota === 0) return null;

  const usedMb = usage.used / (1024 * 1024);
  const quotaMb = usage.quota / (1024 * 1024);
  const pct = Math.min(100, (usage.used / usage.quota) * 100);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-floating">
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-medium text-ink">Device storage used</span>
        <span className="text-ink-muted">
          {usedMb.toFixed(0)} MB / {quotaMb >= 1024 ? `${(quotaMb / 1024).toFixed(1)} GB` : `${quotaMb.toFixed(0)} MB`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/5">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
