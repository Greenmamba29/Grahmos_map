import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  action?: ReactNode;
}

export function ScreenHeader({ title, subtitle, showBack = false, action }: ScreenHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-white/95 px-4 pt-safe backdrop-blur-sm">
      <div className="flex items-center gap-2 py-3">
        {showBack && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="tap-target -ml-2 grid h-10 w-10 place-items-center rounded-full text-ink-muted hover:bg-canvas"
          >
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] font-semibold leading-tight text-ink">{title}</h1>
          {subtitle && <p className="truncate text-[13px] text-ink-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
