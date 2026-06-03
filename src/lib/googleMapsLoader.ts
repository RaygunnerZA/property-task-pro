import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

let placesPromise: Promise<google.maps.PlacesLibrary> | null = null;

export function getGoogleMapsApiKey(): string | undefined {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  return key?.trim() || undefined;
}

export function loadGoogleMapsPlaces(): Promise<google.maps.PlacesLibrary> {
  if (placesPromise) return placesPromise;

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(new Error("Missing VITE_GOOGLE_MAPS_API_KEY"));
  }

  setOptions({ key: apiKey, v: "weekly" });
  placesPromise = importLibrary("places");
  return placesPromise;
}
