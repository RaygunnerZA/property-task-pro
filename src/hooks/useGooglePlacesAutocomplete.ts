import { useEffect, useRef, type RefObject } from "react";
import { loadGoogleMapsPlaces } from "@/lib/googleMapsLoader";

interface UseGooglePlacesAutocompleteOptions {
  onPlaceSelected: (address: string) => void;
  enabled?: boolean;
}

export function useGooglePlacesAutocomplete(
  inputRef: RefObject<HTMLInputElement | null>,
  { onPlaceSelected, enabled = true }: UseGooglePlacesAutocompleteOptions
) {
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  onPlaceSelectedRef.current = onPlaceSelected;

  useEffect(() => {
    if (!enabled || !inputRef.current) return;

    let autocomplete: google.maps.places.Autocomplete | null = null;
    let cancelled = false;

    void loadGoogleMapsPlaces()
      .then(() => {
        if (cancelled || !inputRef.current) return;

        const instance = new google.maps.places.Autocomplete(inputRef.current, {
          types: ["address"],
          fields: ["formatted_address"],
        });
        autocomplete = instance;

        instance.addListener("place_changed", () => {
          const place = instance.getPlace();
          if (place?.formatted_address) {
            onPlaceSelectedRef.current(place.formatted_address);
          }
        });
      })
      .catch(() => {
        // Missing API key or load failure — plain text input still works.
      });

    return () => {
      cancelled = true;
      if (autocomplete && typeof google !== "undefined") {
        google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [enabled, inputRef]);
}
