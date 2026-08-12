import { useMemo, useState } from "react";
import { useAppStore } from "../../store/appStore";
import { mapRef } from "../../map/mapInstance";
import { CATEGORY_META } from "../../config";
import { Icon } from "../ui/Icon";

/** Floating rounded search bar with mic — searches facilities offline. */
export function SearchBar() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const facilities = useAppStore((s) => s.facilities);
  const selectFacility = useAppStore((s) => s.selectFacility);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return facilities
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.category.includes(q) ||
          f.address?.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [query, facilities]);

  const pick = (id: string, lng: number, lat: number) => {
    setQuery("");
    setFocused(false);
    selectFacility(id);
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, padding: { bottom: 260 } });
  };

  return (
    <div className="pointer-events-auto relative">
      <div className="flex items-center gap-3 rounded-full bg-white px-4 py-3 shadow-[var(--shadow-float)]">
        <Icon name="search" size={20} className="shrink-0 text-ink-soft" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search hospitals, shelters, water…"
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink-soft"
          aria-label="Search facilities"
        />
        <button aria-label="Voice search" className="shrink-0 text-primary">
          <Icon name="mic" size={20} />
        </button>
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-white">
          R
        </span>
      </div>

      {focused && results.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-float)]">
          {results.map((f) => {
            const meta = CATEGORY_META[f.category];
            return (
              <li key={f.id}>
                <button
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                  onMouseDown={() => pick(f.id, f.lng, f.lat)}
                >
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-full"
                    style={{ background: `${meta.color}1a`, color: meta.color }}
                  >
                    <Icon name={meta.icon} size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {f.name}
                    </span>
                    <span className="block truncate text-xs text-ink-soft">
                      {f.address ?? meta.label}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
