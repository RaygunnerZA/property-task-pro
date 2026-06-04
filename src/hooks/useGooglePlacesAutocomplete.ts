import { useEffect, useRef, type RefObject } from "react";
import { loadGoogleMapsPlaces } from "@/lib/googleMapsLoader";
import type { PlaceSelection } from "@/lib/signals/signalTypes";

const ADDRESS_PRIMARY_TYPES = ["street_address", "premise", "subpremise", "route"];

interface UseGooglePlacesAutocompleteOptions {
  onPlaceSelected: (place: PlaceSelection) => void;
  onInputChange?: (value: string) => void;
  enabled?: boolean;
  placeholder?: string;
  value?: string;
}

function latLngToNumber(
  loc: google.maps.LatLng | google.maps.LatLngLiteral | undefined,
  axis: "lat" | "lng"
): number | undefined {
  if (!loc) return undefined;
  const v = loc[axis];
  return typeof v === "function" ? (v as () => number).call(loc) : v;
}

function placeToSelection(
  place: google.maps.places.Place,
  placeId: string
): PlaceSelection | null {
  const formattedAddress = place.formattedAddress?.trim();
  if (!formattedAddress) return null;
  return {
    formattedAddress,
    placeId,
    latitude: latLngToNumber(place.location, "lat"),
    longitude: latLngToNumber(place.location, "lng"),
    addressComponents: place.addressComponents,
  };
}

export function useGooglePlacesAutocomplete(
  containerRef: RefObject<HTMLDivElement | null>,
  {
    onPlaceSelected,
    onInputChange,
    enabled = true,
    placeholder,
    value,
  }: UseGooglePlacesAutocompleteOptions
) {
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  const onInputChangeRef = useRef(onInputChange);
  const widgetRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  onPlaceSelectedRef.current = onPlaceSelected;
  onInputChangeRef.current = onInputChange;

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    let cancelled = false;
    let selectHandler: ((event: google.maps.places.PlacePredictionSelectEvent) => void) | null =
      null;
    let inputHandler: ((event: Event) => void) | null = null;

    void loadGoogleMapsPlaces()
      .then(() => {
        if (cancelled || !containerRef.current) return;

        const container = containerRef.current;
        container.replaceChildren();

        const widget = new google.maps.places.PlaceAutocompleteElement({
          includedPrimaryTypes: ADDRESS_PRIMARY_TYPES,
        });
        if (placeholder) widget.placeholder = placeholder;
        if (value != null) widget.value = value;

        widgetRef.current = widget;
        container.appendChild(widget);

        selectHandler = async (event: google.maps.places.PlacePredictionSelectEvent) => {
          const { placePrediction } = event;
          const place = placePrediction.toPlace();
          await place.fetchFields({
            fields: ["formattedAddress", "location", "addressComponents"],
          });
          const selection = placeToSelection(place, placePrediction.placeId);
          if (selection) onPlaceSelectedRef.current(selection);
        };
        widget.addEventListener("gmp-select", selectHandler);

        inputHandler = () => {
          onInputChangeRef.current?.(widget.value);
        };
        widget.addEventListener("input", inputHandler);
      })
      .catch(() => {
        // Missing API key or load failure — plain text fallback in parent.
      });

    return () => {
      cancelled = true;
      const widget = widgetRef.current;
      if (widget && selectHandler) {
        widget.removeEventListener("gmp-select", selectHandler);
      }
      if (widget && inputHandler) {
        widget.removeEventListener("input", inputHandler);
      }
      widgetRef.current = null;
      containerRef.current?.replaceChildren();
    };
  }, [enabled, containerRef, placeholder]);

  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget || value === undefined) return;
    if (widget.value !== value) widget.value = value;
  }, [value]);
}
