import { NavLink } from "react-router-dom";
import { Compass, Route, Bookmark, CloudOff, Bell } from "lucide-react";
import clsx from "clsx";

const TABS = [
  { to: "/", label: "Explore", icon: Compass, end: true },
  { to: "/routes", label: "Routes", icon: Route },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/offline", label: "Offline", icon: CloudOff },
  { to: "/alerts", label: "Alerts", icon: Bell },
];

export function BottomTabBar() {
  return (
    <nav className="pointer-events-auto flex items-stretch justify-between border-t border-black/5 bg-white/95 px-1 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5 backdrop-blur">
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            clsx(
              "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium transition-colors",
              isActive ? "text-accent" : "text-ink-muted hover:text-ink",
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
