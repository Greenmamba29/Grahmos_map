import { formatDistance } from "../../utils/format";
import { Icon } from "../ui/Icon";
import type { RouteStep } from "../../types";

/** Numbered turn-by-turn steps list. */
export function StepsList({ steps }: { steps: RouteStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => (
        <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
          {i < steps.length - 1 && (
            <span className="absolute left-[13px] top-8 bottom-0 w-0.5 bg-line" />
          )}
          <span
            className={`z-10 grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
              i === steps.length - 1
                ? "bg-down text-white"
                : "bg-primary text-white"
            }`}
          >
            {i + 1}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-medium leading-snug">{s.instruction}</p>
            <p className="text-xs text-ink-soft">{formatDistance(s.distanceM / 1000)}</p>
            {s.caution && (
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-warn">
                <Icon name="warning" size={12} />
                {s.caution}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
