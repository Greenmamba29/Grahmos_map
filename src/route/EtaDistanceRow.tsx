export function EtaDistanceRow({
  etaMinutes,
  distanceM,
}: {
  etaMinutes: number;
  distanceM: number;
}) {
  const distanceKm = distanceM / 1000;
  const distanceLabel =
    distanceKm >= 1 ? `${distanceKm.toFixed(1)} km` : `${Math.round(distanceM)} m`;
  const etaLabel = etaMinutes >= 60 ? `${Math.floor(etaMinutes / 60)}h ${etaMinutes % 60}m` : `${etaMinutes} min`;

  return (
    <div className="flex items-baseline gap-3">
      <span className="text-2xl font-semibold text-ink">{etaLabel}</span>
      <span className="text-sm font-medium text-ink-muted">({distanceLabel})</span>
    </div>
  );
}
