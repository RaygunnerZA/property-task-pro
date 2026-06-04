/** Minimal typings for Place Autocomplete (New) — not yet in @types/google.maps. */
declare namespace google.maps.places {
  interface PlaceAutocompleteElementOptions {
    includedPrimaryTypes?: string[];
    placeholder?: string;
  }

  interface PlacePredictionSelectEvent extends Event {
    placePrediction: {
      /** Canonical place ID for Places API (New); prefer over Place.id after fetchFields. */
      placeId: string;
      toPlace: () => google.maps.places.Place;
    };
  }

  class PlaceAutocompleteElement extends HTMLElement {
    constructor(options?: PlaceAutocompleteElementOptions);
    placeholder: string;
    value: string;
    addEventListener(
      type: "gmp-select",
      listener: (event: PlacePredictionSelectEvent) => void | Promise<void>
    ): void;
    addEventListener(type: "input", listener: (event: Event) => void): void;
    removeEventListener(
      type: "gmp-select",
      listener: (event: PlacePredictionSelectEvent) => void | Promise<void>
    ): void;
    removeEventListener(type: "input", listener: (event: Event) => void): void;
  }

  interface Place {
    id?: string;
    formattedAddress?: string;
    location?: google.maps.LatLng | google.maps.LatLngLiteral;
    addressComponents?: google.maps.GeocoderAddressComponent[];
    fetchFields: (request: { fields: string[] }) => Promise<void>;
  }
}
