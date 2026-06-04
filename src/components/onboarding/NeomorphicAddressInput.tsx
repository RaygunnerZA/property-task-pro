import { forwardRef, useCallback, useRef, type ChangeEvent, type MutableRefObject } from "react";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { useGooglePlacesAutocomplete } from "@/hooks/useGooglePlacesAutocomplete";
import { getGoogleMapsApiKey } from "@/lib/googleMapsLoader";

import type { PlaceSelection } from "@/lib/signals/signalTypes";

interface NeomorphicAddressInputProps
  extends React.ComponentPropsWithoutRef<typeof NeomorphicInput> {
  onPlaceSelected?: (place: PlaceSelection) => void;
}

export const NeomorphicAddressInput = forwardRef<
  HTMLInputElement,
  NeomorphicAddressInputProps
>(({ onChange, onPlaceSelected, ...props }, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      (inputRef as MutableRefObject<HTMLInputElement | null>).current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as MutableRefObject<HTMLInputElement | null>).current = node;
      }
    },
    [ref]
  );

  const handlePlaceSelected = useCallback(
    (place: PlaceSelection) => {
      onChange?.({
        target: { value: place.formattedAddress },
      } as ChangeEvent<HTMLInputElement>);
      onPlaceSelected?.(place);
    },
    [onChange, onPlaceSelected]
  );

  useGooglePlacesAutocomplete(inputRef, {
    onPlaceSelected: handlePlaceSelected,
    enabled: !!getGoogleMapsApiKey(),
  });

  return (
    <NeomorphicInput
      ref={setRefs}
      onChange={onChange}
      autoComplete="off"
      {...props}
    />
  );
});

NeomorphicAddressInput.displayName = "NeomorphicAddressInput";
