import { TriangleAlert } from 'lucide-react';
import { formatDistance } from '@/lib/format';
import type { RouteStep } from '@/types';

interface TurnStepsListProps {
  steps: RouteStep[];
  onStepHover?: (step: RouteStep | null) => void;
}

export function TurnStepsList({ steps, onStepHover }: TurnStepsListProps) {
  return (
    <ol className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline">
      {steps.map((step) => (
        <li
          key={step.index}
          onMouseEnter={() => onStepHover?.(step)}
          onMouseLeave={() => onStepHover?.(null)}
          className="flex gap-3 px-3.5 py-3"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-soft text-[12px] font-semibold text-primary-dark">
            {step.index}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] leading-snug text-ink">{step.instruction}</span>
            {step.distanceM > 0 && (
              <span className="mt-0.5 block text-[12.5px] text-ink-muted">
                {formatDistance(step.distanceM)}
              </span>
            )}
            {step.warning && (
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2 py-0.5 text-[11.5px] font-medium text-ink">
                <TriangleAlert size={11} strokeWidth={2.4} style={{ color: '#b06000' }} />
                {step.warning}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
