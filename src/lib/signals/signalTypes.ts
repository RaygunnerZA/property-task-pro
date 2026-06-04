export interface PlaceSelection {
  formattedAddress: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
  addressComponents?: google.maps.GeocoderAddressComponent[];
}

export interface SignalRow {
  id: string;
  org_id: string;
  property_id: string | null;
  space_id: string | null;
  asset_id: string | null;
  kind: string;
  category: string;
  subtype: string;
  severity: string;
  title: string;
  body: string | null;
  review_state: string;
  disposition: string;
  source: string;
  payload: Record<string, unknown>;
  recommendation: Record<string, unknown> | null;
  dedupe_key: string | null;
  expires_at: string | null;
  resolved_at: string | null;
  converted_entity_type: string | null;
  converted_entity_id: string | null;
  created_at: string;
  updated_at: string;
}
