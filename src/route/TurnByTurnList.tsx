import { ArrowRight, MapPin } from "lucide-react";
import type { RouteStep } from "./mockRouting";

export function TurnByTurnList({ steps }: { steps: RouteStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3 border-b border-black/5 py-3 last:border-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
            {i + 1}
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-ink">{step.instruction}</p>
            {step.distanceM > 0 && (
              <p className="text-xs text-ink-muted">
                {step.distanceM >= 1000
                  ? `${(step.distanceM / 1000).toFixed(1)} km`
                  : `${step.distanceM} m`}
              </p>
            )}
          </div>
          {i === steps.length - 1 ? (
            <MapPin size={16} className="mt-1 shrink-0 text-status-offline" />
          ) : (
            <ArrowRight size={16} className="mt-1 shrink-0 text-ink-faint" />
          )}
        </li>
      ))}
    </ol>
  );
}
