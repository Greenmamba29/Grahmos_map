import { useState } from "react";
import { Search, Mic, SlidersHorizontal, ArrowLeft } from "lucide-react";
import { IconButton } from "@/ui/IconButton";
import { useFilterStore } from "@/store/useFilterStore";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onFocusChange?: (focused: boolean) => void;
}

export function SearchBar({ value, onChange, onFocusChange }: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const openFilterSheet = useFilterStore((s) => s.openFilterSheet);

  function setFocus(next: boolean) {
    setFocused(next);
    onFocusChange?.(next);
  }

  return (
    <div className="flex items-center gap-2 rounded-full bg-white px-2 py-2 shadow-floating">
      {focused ? (
        <button
          type="button"
          onClick={() => setFocus(false)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-black/5"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center text-ink-muted">
          <Search size={20} />
        </span>
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        placeholder="Search hospitals, shelters, water points…"
        className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
      />
      <IconButton
        icon={<SlidersHorizontal size={18} />}
        size="sm"
        variant="ghost"
        aria-label="Open filters"
        onClick={openFilterSheet}
      />
      <IconButton
        icon={<Mic size={18} className="text-accent" />}
        size="sm"
        variant="ghost"
        aria-label="Search by voice"
      />
    </div>
  );
}
