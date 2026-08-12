import { cn } from '@/lib/cn';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-[18px] w-[34px] shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-hairline',
        disabled && 'opacity-40',
      )}
    >
      <span
        className={cn(
          'absolute h-[22px] w-[22px] rounded-full bg-white shadow-[var(--shadow-pill)] transition-transform',
          checked ? 'translate-x-[14px]' : 'translate-x-[-2px]',
        )}
      />
    </button>
  );
}
