interface TabsProps<T extends string> {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}

/** Google-Maps-style underlined tab row (Overview / Capacity / ...). */
export function Tabs<T extends string>({ tabs, active, onChange }: TabsProps<T>) {
  return (
    <div className="flex border-b border-line" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={`relative flex-1 py-3 text-sm font-medium transition-colors ${
            active === t.id ? "text-primary" : "text-ink-soft hover:text-ink"
          }`}
        >
          {t.label}
          {active === t.id && (
            <span className="absolute inset-x-4 bottom-0 h-[3px] rounded-t-full bg-primary" />
          )}
        </button>
      ))}
    </div>
  );
}
