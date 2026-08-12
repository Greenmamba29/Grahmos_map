export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / 1_000_000;
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  if (mb < 1000) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  return `${(mb / 1000).toFixed(2)} GB`;
}

export function formatDistance(metres: number | undefined): string {
  if (metres === undefined || !Number.isFinite(metres)) return '—';
  if (metres < 950) return `${Math.round(metres / 10) * 10} m`;
  const km = metres / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${hours} hr` : `${hours} hr ${rem} min`;
}

export function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return 'never verified';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'unknown';
  const diffMs = Date.now() - then;
  if (diffMs < 0) return 'scheduled';
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

export function hoursSince(iso: string | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - then) / 3_600_000);
}

export function formatElevation(metres: number): string {
  return `${Math.round(metres).toLocaleString()} m`;
}

export function formatPhoneHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, '')}`;
}
