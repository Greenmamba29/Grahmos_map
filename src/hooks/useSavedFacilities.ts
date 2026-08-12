import { useCallback, useEffect } from 'react';
import { savedStore } from '@/lib/db';
import { useSession } from '@/state/session';

/** Saved list, persisted in IndexedDB so it survives an offline cold start. */
export function useSavedFacilities() {
  const savedIds = useSession((state) => state.savedIds);
  const setSavedIds = useSession((state) => state.setSavedIds);

  useEffect(() => {
    void savedStore.ids().then(setSavedIds);
  }, [setSavedIds]);

  const toggleSaved = useCallback(
    async (facilityId: string) => {
      await savedStore.toggle(facilityId);
      setSavedIds(await savedStore.ids());
    },
    [setSavedIds],
  );

  return { savedIds, toggleSaved };
}
