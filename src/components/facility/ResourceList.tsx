import { AVAILABILITY_META, RESOURCE_LABELS } from '@/lib/taxonomy';
import type { Facility, ResourceAvailability, ResourceKey } from '@/types';

interface ResourceListProps {
  facility: Facility;
}

const ORDER: ResourceKey[] = ['power', 'water', 'fuel', 'oxygen', 'beds', 'food', 'medical'];

export function ResourceList({ facility }: ResourceListProps) {
  const entries = ORDER.map((key) => [key, facility.resources[key]] as const).filter(
    (entry): entry is readonly [ResourceKey, ResourceAvailability] => entry[1] !== undefined,
  );

  if (entries.length === 0) {
    return (
      <p className="rounded-2xl bg-canvas px-4 py-3 text-[14px] text-ink-muted">
        No resource information has been reported for this site.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline">
      {entries.map(([key, availability]) => {
        const meta = AVAILABILITY_META[availability];
        return (
          <li key={key} className="flex items-center justify-between px-4 py-3">
            <span className="text-[15px] text-ink">{RESOURCE_LABELS[key] ?? key}</span>
            <span
              className="inline-flex items-center gap-1.5 text-[13px] font-medium"
              style={{ color: meta.color }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: meta.color }}
                aria-hidden
              />
              {meta.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
