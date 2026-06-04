import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

let placesPromise: Promise<google.maps.PlacesLibrary> | null = null;
let mapsPromise: Promise<google.maps.MapsLibrary> | null = null;

export function getGoogleMapsApiKey(): string | undefined {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  return key?.trim() || undefined;
}

function ensureOptions() {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw new Error("Missing VITE_GOOGLE_MAPS_API_KEY");
  }
  setOptions({ key: apiKey, v: "weekly" });
}

export function loadGoogleMapsPlaces(): Promise<google.maps.PlacesLibrary> {
  if (placesPromise) return placesPromise;
  ensureOptions();
  placesPromise = importLibrary("places");
  return placesPromise;
}

export function loadGoogleMapsMap(): Promise<google.maps.MapsLibrary> {
  if (mapsPromise) return mapsPromise;
  ensureOptions();
  mapsPromise = importLibrary("maps");
  return mapsPromise;
}
