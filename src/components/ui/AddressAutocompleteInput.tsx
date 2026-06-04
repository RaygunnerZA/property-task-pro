import { forwardRef, useCallback, useRef, type ChangeEvent, type MutableRefObject } from "react";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGooglePlacesAutocomplete } from "@/hooks/useGooglePlacesAutocomplete";
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
>(({ label, error, neomorphic, onChange, onPlaceSelected, className, ...props }, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      (inputRef as MutableRefObject<HTMLInputElement | null>).current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as MutableRefObject<HTMLInputElement | null>).current = node;
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

  if (neomorphic) {
    return (
      <NeomorphicInput
        ref={setRefs}
        label={label}
        error={error}
        onChange={onChange}
        autoComplete="off"
        className={className}
        {...props}
      />
    );
  }

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={props.id}>{label}</Label>}
      <Input
        ref={setRefs}
        onChange={onChange}
        autoComplete="off"
        className={cn(className)}
        {...props}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
});

AddressAutocompleteInput.displayName = "AddressAutocompleteInput";
