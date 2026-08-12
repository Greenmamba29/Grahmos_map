import { CircleAlert, TriangleAlert } from 'lucide-react';
import { HAZARD_LABELS } from '@/lib/taxonomy';
import type { RoutePlan } from '@/types';

interface CautionBannerProps {
  plan: RoutePlan;
}

/**
 * Resilience caution banner.
 *
 * Maps warns that "conditions may vary"; here the warning has to be specific and
 * actionable, so it names what is crossed, what was routed around, and how old the
 * road-condition reports along the route are.
 */
export function CautionBanner({ plan }: CautionBannerProps) {
  const crossing = plan.crossedHazards.length > 0;
  const stale = plan.staleHours > 48;

  if (!crossing && !stale && plan.avoidedHazards.length === 0) return null;

  const tone = crossing
    ? { bg: 'bg-critical-soft', color: '#d93025', Icon: TriangleAlert }
    : { bg: 'bg-warning-soft', color: '#b06000', Icon: CircleAlert };

  return (
    <div className={`flex items-start gap-2.5 rounded-2xl ${tone.bg} px-3.5 py-3`}>
      <tone.Icon size={17} strokeWidth={2.2} style={{ color: tone.color }} className="mt-0.5 shrink-0" />
      <div className="min-w-0 text-[13px] leading-snug text-ink">
        {crossing && (
          <p className="font-medium">
            This route passes through{' '}
            {plan.crossedHazards.map((hazard) => HAZARD_LABELS[hazard.kind]).join(', ')}. It may be
            blocked.
          </p>
        )}

        {!crossing && stale && (
          <p className="font-medium">
            Road conditions on this route have not been verified for{' '}
            {Number.isFinite(plan.staleHours) ? `${Math.round(plan.staleHours)} hours` : 'an unknown period'}.
          </p>
        )}

        {plan.avoidedHazards.length > 0 && (
          <p className="mt-1 text-ink-muted">
            Routed around {plan.avoidedHazards.length} impassable{' '}
            {plan.avoidedHazards.length === 1 ? 'zone' : 'zones'}:{' '}
            {plan.avoidedHazards.map((hazard) => HAZARD_LABELS[hazard.kind]).join(', ')}.
          </p>
        )}

        <p className="mt-1 text-ink-muted">
          Confirm on the radio net before committing a vehicle.
        </p>
      </div>
    </div>
  );
}
