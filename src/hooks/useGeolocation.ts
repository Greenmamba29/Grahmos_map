import { useCallback } from "react";
import { env } from "../config";
import { useAppStore } from "../store/appStore";

/**
 * Requests the device position once and stores it. Falls back to the
 * configured default center when geolocation is unavailable/denied so the
 * "my location" experience still works in demos.
 */
export function useGeolocation() {
  const setUserLocation = useAppStore((s) => s.setUserLocation);

  const locate = useCallback(
    () =>
      new Promise<{ lng: number; lat: number }>((resolve) => {
        const fallback = { lng: env.defaultCenter[0], lat: env.defaultCenter[1] };
        if (!("geolocation" in navigator)) {
          setUserLocation(fallback);
          resolve(fallback);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lng: pos.coords.longitude, lat: pos.coords.latitude };
            setUserLocation(loc);
            resolve(loc);
          },
          () => {
            setUserLocation(fallback);
            resolve(fallback);
          },
          { enableHighAccuracy: true, timeout: 8000 },
        );
      }),
    [setUserLocation],
  );

  return { locate };
}
