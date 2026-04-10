import { useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";

const STORAGE_KEY = "signal_ui_fixtures";

function readLocalStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * UI sample signals for taxonomy / icon tuning.
 *
 * - **Dev:** on by default unless `localStorage.signal_ui_fixtures = '0'`.
 * - **Any build:** `?signalFixtures=1` forces on; `?signalFixtures=0` forces off.
 * - **Prod:** set `localStorage.signal_ui_fixtures = '1'` to enable without URL.
 */
export function useSignalUiFixturesEnabled(): boolean {
  const [searchParams] = useSearchParams();
  const urlFlag = searchParams.get("signalFixtures");

  const storageVal = useSyncExternalStore(subscribe, readLocalStorage, () => null);

  return useMemo(() => {
    if (urlFlag === "0") return false;
    if (urlFlag === "1") return true;
    if (storageVal === "0") return false;
    if (storageVal === "1") return true;
    return import.meta.env.DEV;
  }, [urlFlag, storageVal]);
}
