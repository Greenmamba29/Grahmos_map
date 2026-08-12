import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

/**
 * Update prompt.
 *
 * Updates are never applied silently: a responder mid-task should decide when the
 * app reloads, because a reload during a field report is worse than running a
 * build that is a few minutes old.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(url) {
      console.info('[sw] registered', url);
    },
    onRegisterError(error) {
      console.warn('[sw] registration failed', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-4 bottom-[72px] z-50 flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-[var(--shadow-map)] md:left-auto md:right-4 md:w-96">
      <RefreshCw size={18} strokeWidth={2.2} className="shrink-0" />
      <p className="min-w-0 flex-1 text-[13.5px] leading-snug">
        A new version is ready. Reload when you are at a safe stopping point.
      </p>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold text-ink"
      >
        Reload
      </button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        className="shrink-0 text-[13px] text-white/70"
      >
        Later
      </button>
    </div>
  );
}
