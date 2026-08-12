import { DEMO_ALERTS } from "../data/demoData";
import { Icon } from "../components/ui/Icon";
import { timeAgo } from "../utils/format";

const SEVERITY_META = {
  critical: { icon: "warning", color: "#d93025", bg: "#fce8e6", label: "Critical" },
  warning: { icon: "warning", color: "#b06000", bg: "#fef7e0", label: "Warning" },
  info: { icon: "info", color: "#1a73e8", bg: "#e8f0fe", label: "Info" },
} as const;

/** Feed of status changes and broadcast alerts. */
export function AlertsScreen() {
  return (
    <div className="grow overflow-y-auto bg-gray-50">
      <div className="px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <h1 className="text-xl font-medium">Alerts</h1>
        <p className="text-sm text-ink-soft">
          Status changes and emergency broadcasts for your area.
        </p>
      </div>
      <ul className="space-y-2 px-4 pb-6">
        {DEMO_ALERTS.map((a) => {
          const meta = SEVERITY_META[a.severity];
          return (
            <li
              key={a.id}
              className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm"
            >
              <span
                className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full"
                style={{ background: meta.bg, color: meta.color }}
              >
                <Icon name={meta.icon} size={18} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  <span className="text-xs text-ink-soft">
                    {timeAgo(a.createdAt)}
                  </span>
                </div>
                <p className="mt-1 font-medium leading-snug">{a.title}</p>
                <p className="text-sm text-ink-soft">{a.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
