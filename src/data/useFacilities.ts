import { useCallback, useEffect, useState } from "react";
import { fetchFacilities } from "./facilities";
import type { Facility } from "./types";

interface UseFacilitiesResult {
  facilities: Facility[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useFacilities(): UseFacilitiesResult {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFacilities(await fetchFacilities());
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason : new Error("Unable to load facilities"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { facilities, loading, error, refresh };
}
