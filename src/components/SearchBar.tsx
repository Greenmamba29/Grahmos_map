import { Menu, Mic, Search } from 'lucide-react';

type SearchBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
};

export function SearchBar({ query, onQueryChange }: SearchBarProps) {
  return (
    <label className="flex h-14 items-center gap-3 rounded-2xl bg-white px-4 shadow-[0_10px_30px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70">
      <Menu aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-600" />
      <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400" />
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-medium text-slate-900 outline-none placeholder:text-slate-500"
        placeholder="Search critical infrastructure"
        type="search"
      />
      <button
        type="button"
        className="rounded-full p-2 text-[#1A73E8] transition hover:bg-blue-50"
        aria-label="Voice search"
      >
        <Mic aria-hidden="true" className="h-5 w-5" />
      </button>
    </label>
  );
}
