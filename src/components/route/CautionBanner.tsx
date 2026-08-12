import { Icon } from "../ui/Icon";

/** Amber resilience alert — repurposed "conditions may vary" banner. */
export function CautionBanner({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-[#fdd663] bg-[#fef7e0] px-4 py-3">
      <Icon name="warning" size={18} className="mt-0.5 shrink-0 text-[#b06000]" />
      <p className="text-[13px] leading-snug text-[#b06000]">{text}</p>
    </div>
  );
}
