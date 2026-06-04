import { supabase } from "@/integrations/supabase/client";
import type { PlaceSelection } from "@/lib/signals/signalTypes";

export async function enrichPropertyGeo(
  propertyId: string,
  orgId: string,
  place?: PlaceSelection
): Promise<void> {
  const { error } = await supabase.functions.invoke("property-geo-enrich", {
    body: {
      property_id: propertyId,
      org_id: orgId,
      address: place?.formattedAddress,
      place_id: place?.placeId,
      latitude: place?.latitude,
      longitude: place?.longitude,
      address_formatted: place?.formattedAddress,
      address_components: place?.addressComponents,
    },
  });
  if (error) {
    console.warn("[property-geo-enrich]", error.message);
  }
}

export async function validateAddress(
  orgId: string,
  address: string,
  propertyId?: string
): Promise<{ valid: boolean; signals: string[]; formatted?: string }> {
  const { data, error } = await supabase.functions.invoke("address-validate", {
    body: { org_id: orgId, address, property_id: propertyId },
  });
  if (error) throw error;
  return data as { valid: boolean; signals: string[]; formatted?: string };
}

/** Manual scanner invoke — pass force: true to bypass 12h per-property cooldown. */
export async function runEnvironmentalScanner(
  orgId?: string,
  options?: { force?: boolean }
): Promise<void> {
  void supabase.functions.invoke("environmental-scanner", {
    body: {
      ...(orgId ? { org_id: orgId } : {}),
      ...(options?.force ? { force: true } : {}),
    },
  });
}
