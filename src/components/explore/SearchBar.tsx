import { Mic, Search } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  onMic?: () => void
  placeholder?: string
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  onMic,
  placeholder = 'Search hospitals, shelters, water…',
}: SearchBarProps) {
  return (
    <form
      className="flex items-center gap-2 rounded-full bg-surface px-3 py-2.5 shadow-[var(--shadow-float)]"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.()
      }}
    >
      <Search className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
        aria-label="Search facilities"
      />
      <button
        type="button"
        onClick={onMic}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-black/[0.05]"
        aria-label="Voice search"
      >
        <Mic className="h-5 w-5" />
      </button>
    </form>
  )
}
