import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import clsx from "clsx";

type Severity = "info" | "warning" | "danger";

const SEVERITY_STYLES: Record<Severity, { bg: string; fg: string; icon: typeof Info }> = {
  info: { bg: "#E8F0FE", fg: "#1A73E8", icon: Info },
  warning: { bg: "#FEF7E0", fg: "#B06000", icon: AlertTriangle },
  danger: { bg: "#FCE8E6", fg: "#D93025", icon: OctagonAlert },
};

export function CautionBanner({
  severity = "warning",
  message,
  reportedBy,
}: {
  severity?: Severity;
  message: string;
  reportedBy?: string;
}) {
  const style = SEVERITY_STYLES[severity];
  const Icon = style.icon;
  return (
    <div
      className={clsx("flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm")}
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-medium">{message}</p>
        {reportedBy && <p className="text-xs opacity-80">Reported by {reportedBy}</p>}
      </div>
    </div>
  );
}
