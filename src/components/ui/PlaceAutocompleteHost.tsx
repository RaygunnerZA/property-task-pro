import { useRef } from "react";
import { useGooglePlacesAutocomplete } from "@/hooks/useGooglePlacesAutocomplete";
import { getGoogleMapsApiKey } from "@/lib/googleMapsLoader";
import type { PlaceSelection } from "@/lib/signals/signalTypes";
import { cn } from "@/lib/utils";

interface PlaceAutocompleteHostProps {
  className?: string;
  variant?: "default" | "neomorphic";
  placeholder?: string;
  value?: string;
  onInputChange?: (value: string) => void;
  onPlaceSelected?: (place: PlaceSelection) => void;
}

export function PlaceAutocompleteHost({
  className,
  variant = "default",
  placeholder,
  value,
  onInputChange,
  onPlaceSelected,
}: PlaceAutocompleteHostProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasKey = !!getGoogleMapsApiKey();

  useGooglePlacesAutocomplete(containerRef, {
    enabled: hasKey,
    placeholder,
    value,
    onInputChange,
    onPlaceSelected: (place) => onPlaceSelected?.(place),
  });

  if (!hasKey) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "filla-place-autocomplete-host w-full",
        variant === "neomorphic" && "filla-place-autocomplete-host--neomorphic",
        className
      )}
    />
  );
}
