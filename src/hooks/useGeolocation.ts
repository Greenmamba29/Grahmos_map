import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '@/state/session';

export interface GeolocationState {
  position: [number, number] | null;
  accuracyM: number | null;
  status: 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable';
  error?: string;
}

/**
 * Device position. Geolocation needs a secure context, so on plain HTTP this
 * resolves to `unavailable` and the app keeps using the map centre as the
 * reference point.
 */
export function useGeolocation(): GeolocationState & { locate: () => void } {
  const setReference = useSession((state) => state.setReference);
  const [state, setState] = useState<GeolocationState>({
    position: null,
    accuracyM: null,
    status: 'idle',
  });
  const watchId = useRef<number | null>(null);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({
        position: null,
        accuracyM: null,
        status: 'unavailable',
        error: 'Geolocation is not available on this device',
      });
      return;
    }

    setState((prev) => ({ ...prev, status: 'locating' }));

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position: [number, number] = [coords.longitude, coords.latitude];
        setState({ position, accuracyM: coords.accuracy, status: 'ready' });
        setReference(position, true);
      },
      (error) => {
        setState({
          position: null,
          accuracyM: null,
          status: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable',
          error: error.message,
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }, [setReference]);

  useEffect(() => {
    if (!('geolocation' in navigator) || state.status !== 'ready') return;

    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const position: [number, number] = [coords.longitude, coords.latitude];
        setState((prev) => ({ ...prev, position, accuracyM: coords.accuracy }));
        setReference(position, true);
      },
      undefined,
      { enableHighAccuracy: true, maximumAge: 15_000 },
    );

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [state.status, setReference]);

  return { ...state, locate };
}
