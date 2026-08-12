import { useAppStore } from "../../store/appStore";
import { Icon } from "../ui/Icon";
import type { TabId } from "../../types";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "explore", label: "Explore", icon: "explore" },
  { id: "routes", label: "Routes", icon: "route" },
  { id: "saved", label: "Saved", icon: "bookmark" },
  { id: "offline", label: "Offline", icon: "download" },
  { id: "alerts", label: "Alerts", icon: "bell" },
];

/** Bottom tab bar — Explore / Routes / Saved / Offline / Alerts. */
export function BottomTabBar() {
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);

  return (
    <nav
      className="z-30 flex shrink-0 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]"
      aria-label="Main"
    >
      {TABS.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={active ? "page" : undefined}
            className="flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5"
          >
            <span
              className={`relative grid h-7 w-14 place-items-center rounded-full transition-colors ${
                active ? "bg-primary-soft text-primary" : "text-ink-soft"
              }`}
            >
              <Icon name={t.icon} size={20} />
              {t.id === "alerts" && (
                <span className="absolute right-3 top-0.5 size-2 rounded-full bg-down ring-2 ring-white" />
              )}
            </span>
            <span
              className={`text-[11px] font-medium ${
                active ? "text-primary" : "text-ink-soft"
              }`}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
