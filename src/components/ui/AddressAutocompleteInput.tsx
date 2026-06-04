import { forwardRef, useCallback, type ChangeEvent } from "react";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlaceAutocompleteHost } from "@/components/ui/PlaceAutocompleteHost";
import { getGoogleMapsApiKey } from "@/lib/googleMapsLoader";
import type { PlaceSelection } from "@/lib/signals/signalTypes";
import { cn } from "@/lib/utils";

interface AddressAutocompleteInputProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Input>, "onChange"> {
  label?: string;
  error?: string;
  neomorphic?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onPlaceSelected?: (place: PlaceSelection) => void;
}

export const AddressAutocompleteInput = forwardRef<
  HTMLInputElement,
  AddressAutocompleteInputProps
>(
  (
    {
      label,
      error,
      neomorphic,
      onChange,
      onPlaceSelected,
      className,
      placeholder,
      value,
      id,
      ...props
    },
    ref
  ) => {
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
      const host = (
        <PlaceAutocompleteHost
          variant={neomorphic ? "neomorphic" : "default"}
          className={className}
          placeholder={placeholder}
          value={typeof value === "string" ? value : undefined}
          onInputChange={emitChange}
          onPlaceSelected={handlePlaceSelected}
        />
      );

      if (neomorphic) {
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
            {host}
            {error && <p className="mt-2 text-sm text-[#FF6B6B]">{error}</p>}
          </div>
        );
      }

      return (
        <div className="space-y-2">
          {label && <Label htmlFor={id}>{label}</Label>}
          {host}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      );
    }

    if (neomorphic) {
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
    }

    return (
      <div className="space-y-2">
        {label && <Label htmlFor={id}>{label}</Label>}
        <Input
          ref={ref}
          id={id}
          onChange={onChange}
          placeholder={placeholder}
          value={value}
          autoComplete="off"
          className={cn(className)}
          {...props}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }
);

AddressAutocompleteInput.displayName = "AddressAutocompleteInput";
