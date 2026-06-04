import { useEffect, useRef, type RefObject } from "react";
import { loadGoogleMapsPlaces } from "@/lib/googleMapsLoader";
import type { PlaceSelection } from "@/lib/signals/signalTypes";

interface UseGooglePlacesAutocompleteOptions {
  onPlaceSelected: (place: PlaceSelection) => void;
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
          fields: [
            "formatted_address",
            "place_id",
            "geometry",
            "address_components",
          ],
        });
        autocomplete = instance;

        instance.addListener("place_changed", () => {
          const place = instance.getPlace();
          if (!place?.formatted_address) return;
          const loc = place.geometry?.location;
          onPlaceSelectedRef.current({
            formattedAddress: place.formatted_address,
            placeId: place.place_id,
            latitude: loc?.lat(),
            longitude: loc?.lng(),
            addressComponents: place.address_components,
          });
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
