import { create } from 'zustand';
import { config } from '@/lib/config';
import type { Facility, RoutePlan, TravelMode } from '@/types';

/**
 * Ephemeral cross-screen state: what is selected, what route is planned, and the
 * reference point distances are measured from.
 */
interface SessionState {
  /** The point distances and routes originate from — device GPS or map centre. */
  reference: [number, number];
  hasGpsFix: boolean;
  selectedFacility: Facility | null;
  routeTarget: Facility | null;
  routePlan: RoutePlan | null;
  travelMode: TravelMode;
  savedIds: string[];

  setReference: (reference: [number, number], hasGpsFix?: boolean) => void;
  selectFacility: (facility: Facility | null) => void;
  setRouteTarget: (facility: Facility | null) => void;
  setRoutePlan: (plan: RoutePlan | null) => void;
  setTravelMode: (mode: TravelMode) => void;
  setSavedIds: (ids: string[]) => void;
}

export const useSession = create<SessionState>((set) => ({
  reference: config.defaultCenter,
  hasGpsFix: false,
  selectedFacility: null,
  routeTarget: null,
  routePlan: null,
  travelMode: 'drive',
  savedIds: [],

  setReference: (reference, hasGpsFix = false) => set({ reference, hasGpsFix }),
  selectFacility: (selectedFacility) => set({ selectedFacility }),
  setRouteTarget: (routeTarget) => set({ routeTarget }),
  setRoutePlan: (routePlan) => set({ routePlan }),
  setTravelMode: (travelMode) => set({ travelMode }),
  setSavedIds: (savedIds) => set({ savedIds }),
}));
