import { forwardRef, useCallback, useRef, type ChangeEvent, type MutableRefObject } from "react";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { useGooglePlacesAutocomplete } from "@/hooks/useGooglePlacesAutocomplete";
import { getGoogleMapsApiKey } from "@/lib/googleMapsLoader";

interface NeomorphicAddressInputProps
  extends React.ComponentPropsWithoutRef<typeof NeomorphicInput> {}

export const NeomorphicAddressInput = forwardRef<
  HTMLInputElement,
  NeomorphicAddressInputProps
>(({ onChange, ...props }, ref) => {
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
    (address: string) => {
      onChange?.({
        target: { value: address },
      } as ChangeEvent<HTMLInputElement>);
    },
    [onChange]
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
