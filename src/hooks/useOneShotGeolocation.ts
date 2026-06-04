import { useCallback, useRef } from "react";

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
}

interface OneShotOptions {
  timeoutMs?: number;
  maximumAgeMs?: number;
}

/**
 * One-shot browser geolocation — never uses watchPosition.
 * Returns null if denied, unavailable, or timed out (non-blocking).
 */
export function useOneShotGeolocation() {
  const pendingRef = useRef(false);

  const capture = useCallback(
    (options?: OneShotOptions): Promise<GeoPosition | null> => {
      if (pendingRef.current) return Promise.resolve(null);
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        return Promise.resolve(null);
      }

      pendingRef.current = true;
      const timeoutMs = options?.timeoutMs ?? 8000;

      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pendingRef.current = false;
          resolve(null);
        }, timeoutMs);

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            clearTimeout(timer);
            pendingRef.current = false;
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracyM: pos.coords.accuracy ?? null,
            });
          },
          () => {
            clearTimeout(timer);
            pendingRef.current = false;
            resolve(null);
          },
          {
            enableHighAccuracy: true,
            timeout: timeoutMs,
            maximumAge: options?.maximumAgeMs ?? 60_000,
          }
        );
      });
    },
    []
  );

  return { capture };
}
