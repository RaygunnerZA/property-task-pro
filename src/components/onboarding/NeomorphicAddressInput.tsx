import { forwardRef, useCallback, type ChangeEvent } from "react";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { PlaceAutocompleteHost } from "@/components/ui/PlaceAutocompleteHost";
import { getGoogleMapsApiKey } from "@/lib/googleMapsLoader";
import type { PlaceSelection } from "@/lib/signals/signalTypes";

interface NeomorphicAddressInputProps
  extends React.ComponentPropsWithoutRef<typeof NeomorphicInput> {
  onPlaceSelected?: (place: PlaceSelection) => void;
}

export const NeomorphicAddressInput = forwardRef<
  HTMLInputElement,
  NeomorphicAddressInputProps
>(({ onChange, onPlaceSelected, label, error, placeholder, value, id, className, ...props }, ref) => {
  const hasPlacesKey = !!getGoogleMapsApiKey();

  const emitChange = useCallback(
    (nextValue: string) => {
      onChange?.({
        target: { value: nextValue },
      } as ChangeEvent<HTMLInputElement>);
    },
    [onChange]
  );

  const handlePlaceSelected = useCallback(
    (place: PlaceSelection) => {
      emitChange(place.formattedAddress);
      onPlaceSelected?.(place);
    },
    [emitChange, onPlaceSelected]
  );

  if (hasPlacesKey) {
    return (
      <div className="mb-6">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-[#6D7480] mb-2 text-center"
          >
            {label}
          </label>
        )}
        <PlaceAutocompleteHost
          variant="neomorphic"
          className={className}
          placeholder={placeholder}
          value={typeof value === "string" ? value : undefined}
          onInputChange={emitChange}
          onPlaceSelected={handlePlaceSelected}
        />
        {error && <p className="mt-2 text-sm text-[#FF6B6B]">{error}</p>}
      </div>
    );
  }

  return (
    <NeomorphicInput
      ref={ref}
      label={label}
      error={error}
      id={id}
      onChange={onChange}
      placeholder={placeholder}
      value={value}
      autoComplete="off"
      className={className}
      {...props}
    />
  );
});

NeomorphicAddressInput.displayName = "NeomorphicAddressInput";
