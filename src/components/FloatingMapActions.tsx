import { LocateFixed, Route } from 'lucide-react';

type FloatingMapActionsProps = {
  onLocate: () => void;
};

export function FloatingMapActions({ onLocate }: FloatingMapActionsProps) {
  return (
    <div className="absolute bottom-28 right-4 z-20 flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={onLocate}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1A73E8] shadow-[0_10px_25px_rgba(15,23,42,0.2)] ring-1 ring-slate-200 transition hover:bg-blue-50"
        aria-label="Use my location"
      >
        <LocateFixed aria-hidden="true" className="h-5 w-5" />
      </button>
      <button
        type="button"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1A73E8] text-white shadow-[0_18px_40px_rgba(26,115,232,0.35)] transition hover:bg-blue-700"
        aria-label="Start route"
      >
        <Route aria-hidden="true" className="h-7 w-7" />
      </button>
    </div>
  );
}
