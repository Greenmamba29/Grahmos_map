import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Map as MapIcon, MountainSnow, Play, Route as RouteIcon } from 'lucide-react';
import { MapCanvas } from '@/components/map/MapCanvas';
import { HazardLayer } from '@/components/map/HazardLayer';
import { RouteLine } from '@/components/route/RouteLine';
import { CautionBanner } from '@/components/route/CautionBanner';
import { ElevationProfile } from '@/components/route/ElevationProfile';
import { TravelModeTabs } from '@/components/route/TravelModeTabs';
import { TurnStepsList } from '@/components/route/TurnStepsList';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { useFacilities } from '@/hooks/useFacilities';
import { planRoute } from '@/lib/routing';
import { formatDistance, formatDuration, formatElevation } from '@/lib/format';
import { haversineM } from '@/lib/geo';
import { categoryMeta } from '@/lib/taxonomy';
import { useMapPrefs } from '@/state/mapPrefs';
import { useSession } from '@/state/session';
import type { ElevationSample, Facility, RouteStep, TravelMode } from '@/types';

/**
 * Directions screen: map preview, mode tabs, ETA row, terrain profile, caution
 * banner and numbered steps. Routing runs locally (see `lib/routing.ts`), so this
 * screen behaves identically with the network down.
 */
export function RoutesScreen() {
  const navigate = useNavigate();
  const { all, hazards } = useFacilities();
  const layers = useMapPrefs((state) => state.layers);

  const reference = useSession((state) => state.reference);
  const hasGpsFix = useSession((state) => state.hasGpsFix);
  const routeTarget = useSession((state) => state.routeTarget);
  const setRouteTarget = useSession((state) => state.setRouteTarget);
  const travelMode = useSession((state) => state.travelMode);
  const setTravelMode = useSession((state) => state.setTravelMode);
  const setRoutePlan = useSession((state) => state.setRoutePlan);
  const selectFacility = useSession((state) => state.selectFacility);

  const [scrubPoint, setScrubPoint] = useState<[number, number] | null>(null);

  const plan = useMemo(() => {
    if (!routeTarget) return null;
    return planRoute({
      origin: reference,
      destination: [routeTarget.lng, routeTarget.lat],
      destinationName: routeTarget.name,
      mode: travelMode,
      hazards,
    });
  }, [routeTarget, reference, travelMode, hazards]);

  useEffect(() => {
    setRoutePlan(plan);
  }, [plan, setRoutePlan]);

  const modeEstimates = useMemo(() => {
    if (!routeTarget) return {};
    const modes: TravelMode[] = ['drive', 'truck', 'foot', 'boat'];
    const estimates: Partial<Record<TravelMode, number>> = {};
    for (const mode of modes) {
      estimates[mode] = planRoute({
        origin: reference,
        destination: [routeTarget.lng, routeTarget.lat],
        destinationName: routeTarget.name,
        mode,
        hazards,
      }).durationS;
    }
    return estimates;
  }, [routeTarget, reference, hazards]);

  const onScrub = useCallback((sample: ElevationSample | null) => {
    if (!sample || !plan) {
      setScrubPoint(null);
      return;
    }
    // Map the scrubbed distance back onto the polyline.
    let travelled = 0;
    for (let i = 1; i < plan.coordinates.length; i += 1) {
      const segment = haversineM(plan.coordinates[i - 1], plan.coordinates[i]);
      if (travelled + segment >= sample.distanceM) {
        setScrubPoint(plan.coordinates[i]);
        return;
      }
      travelled += segment;
    }
    setScrubPoint(plan.coordinates[plan.coordinates.length - 1]);
  }, [plan]);

  const onStepHover = useCallback((step: RouteStep | null) => {
    setScrubPoint(step ? [step.lng, step.lat] : null);
  }, []);

  const suggestions = useMemo(
    () =>
      [...all]
        .filter((facility) => facility.status !== 'closed')
        .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))
        .slice(0, 8),
    [all],
  );

  if (!routeTarget || !plan) {
    return (
      <div className="flex h-full flex-col bg-white">
        <ScreenHeader title="Routes" subtitle="Terrain-aware routing that works offline" />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <div className="rounded-2xl bg-primary-soft px-4 py-4">
            <RouteIcon size={20} strokeWidth={2.2} className="text-primary-dark" />
            <p className="mt-2 text-[14.5px] leading-snug text-ink">
              Pick a destination to plan a route. Routes avoid hazard zones and
              penalise steep terrain for heavy vehicles.
            </p>
          </div>

          <h2 className="mt-6 mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Nearest open facilities
          </h2>
          <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline">
            {suggestions.map((facility) => (
              <li key={facility.id}>
                <button
                  type="button"
                  onClick={() => setRouteTarget(facility)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas"
                >
                  <CategoryDot facility={facility} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-ink">
                      {facility.name}
                    </span>
                    <span className="text-[13px] text-ink-muted">
                      {formatDistance(facility.distanceM)} away
                    </span>
                  </span>
                  <ArrowUpRight size={16} strokeWidth={2.2} className="text-ink-muted" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="relative h-[38%] min-h-[220px] shrink-0">
        <MapCanvas interactive>
          <RouteLine plan={plan} marker={scrubPoint} />
          <HazardLayer hazards={hazards} visible={layers.hazards} />
        </MapCanvas>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 pt-safe">
          <button
            type="button"
            onClick={() => setRouteTarget(null)}
            className="pointer-events-auto rounded-full bg-white px-3.5 py-2 text-[13px] font-medium text-ink shadow-[var(--shadow-map)]"
          >
            Change destination
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 px-4 py-4">
          <div>
            <p className="text-[13px] text-ink-muted">
              {hasGpsFix ? 'From your location' : 'From the map centre'} to
            </p>
            <h1 className="text-[19px] font-semibold leading-tight text-ink">
              {routeTarget.name}
            </h1>
          </div>

          <TravelModeTabs mode={travelMode} onChange={setTravelMode} estimates={modeEstimates} />

          <div className="flex items-baseline gap-3">
            <span className="text-[26px] font-semibold leading-none text-primary">
              {formatDuration(plan.durationS)}
            </span>
            <span className="text-[15px] text-ink-muted">{formatDistance(plan.distanceM)}</span>
            <span className="ml-auto inline-flex items-center gap-1 text-[13px] text-ink-muted">
              <MountainSnow size={14} strokeWidth={2.2} />
              {formatElevation(plan.ascentM)} climb · {plan.maxGradePct}% max
            </span>
          </div>

          <CautionBanner plan={plan} />

          <ElevationProfile samples={plan.elevation} onScrub={onScrub} />

          <div>
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
              Steps
            </h2>
            <TurnStepsList steps={plan.steps} onStepHover={onStepHover} />
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-t border-hairline bg-white px-4 py-3 pb-safe">
        <button
          type="button"
          onClick={() => {
            selectFacility(routeTarget);
            navigate('/');
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-full border border-hairline py-3 text-[15px] font-medium text-ink transition-colors hover:bg-canvas"
        >
          <MapIcon size={17} strokeWidth={2.2} />
          Show map
        </button>
        <button
          type="button"
          onClick={() => setScrubPoint(plan.coordinates[0])}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3 text-[15px] font-medium text-white transition-colors hover:bg-primary-dark"
        >
          <Play size={17} strokeWidth={2.2} className="fill-white" />
          Preview
        </button>
      </div>
    </div>
  );
}

function CategoryDot({ facility }: { facility: Facility }) {
  const meta = categoryMeta(facility.category);
  const Icon = meta.icon;
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
      style={{ backgroundColor: meta.color }}
    >
      <Icon size={17} strokeWidth={2.2} />
    </span>
  );
}
