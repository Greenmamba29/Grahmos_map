import { AlertTriangle, CheckCircle2, CloudDownload, Flag } from "lucide-react";

interface AlertItem {
  id: string;
  icon: typeof AlertTriangle;
  color: string;
  title: string;
  detail: string;
  time: string;
}

const ALERTS: AlertItem[] = [
  {
    id: "a1",
    icon: AlertTriangle,
    color: "#D93025",
    title: "Hunters Point Power Station went offline",
    detail: "Repair crew dispatched — reported by field team",
    time: "3h ago",
  },
  {
    id: "a2",
    icon: Flag,
    color: "#1A73E8",
    title: "New status report: Bill Graham Civic Auditorium Shelter",
    detail: "Occupancy near capacity — 780/800",
    time: "25m ago",
  },
  {
    id: "a3",
    icon: CloudDownload,
    color: "#1E8E3E",
    title: "San Francisco — Core region downloaded",
    detail: "84 MB ready for offline use",
    time: "2d ago",
  },
  {
    id: "a4",
    icon: CheckCircle2,
    color: "#1E8E3E",
    title: "St. Francis Memorial Hospital back to operational",
    detail: "Verified by 2 field reports",
    time: "12m ago",
  },
];

export function AlertsScreen() {
  return (
    <div className="h-full overflow-y-auto bg-[#F5F5F3] p-4 pb-24">
      <h1 className="mb-4 text-2xl font-semibold text-ink">Alerts</h1>
      <div className="space-y-2">
        {ALERTS.map(({ id, icon: Icon, color, title, detail, time }) => (
          <div key={id} className="flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-floating">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${color}1A`, color }}
            >
              <Icon size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{title}</p>
              <p className="text-xs text-ink-muted">{detail}</p>
            </div>
            <span className="shrink-0 text-xs text-ink-faint">{time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
