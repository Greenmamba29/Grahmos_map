import clsx from "clsx";

export interface PillOption<T extends string> {
  value: T;
  label: string;
  color?: string;
}

interface PillToggleGroupProps<T extends string> {
  options: PillOption<T>[];
  selected: T[];
  onToggle: (value: T) => void;
}

export function PillToggleGroup<T extends string>({
  options,
  selected,
  onToggle,
}: PillToggleGroupProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            className={clsx(
              "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-150",
              active
                ? "border-transparent bg-accent text-white"
                : "border-black/10 bg-white text-ink hover:bg-black/[0.03]",
            )}
          >
            {option.color && (
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: active ? "white" : option.color }}
              />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
