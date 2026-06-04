// property-geo-enrich — geocode property and emit property intelligence signals
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/geoUtils.ts";
import {
  emitSignal,
  geocodeAddress,
  propertyDedupeKey,
} from "../_shared/signalEngine.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "POST only" }, 405);
  }

  const apiKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    return jsonResponse({ error: "Service role not configured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = await req.json().catch(() => ({}));
  const propertyId = body.property_id as string;
  const orgId = body.org_id as string;
  const address = body.address as string | undefined;
  const placeId = body.place_id as string | undefined;
  const lat = body.latitude as number | undefined;
  const lng = body.longitude as number | undefined;
  const addressFormatted = body.address_formatted as string | undefined;
  const addressComponents = body.address_components as unknown;

  const { data: property, error: propErr } = await admin
    .from("properties")
    .select("id, org_id, address, nickname")
    .eq("id", propertyId)
    .maybeSingle();

  if (propErr || !property) {
    return jsonResponse({ error: "Property not found" }, 404);
  }

  const resolvedOrgId = orgId ?? property.org_id;
  let resolvedLat = lat;
  let resolvedLng = lng;
  let resolvedFormatted = addressFormatted;
  let resolvedPlaceId = placeId;

  if ((resolvedLat == null || resolvedLng == null) && apiKey) {
    const query = address ?? property.address;
    const geo = await geocodeAddress(query, apiKey);
    if (geo) {
      resolvedLat = geo.lat;
      resolvedLng = geo.lng;
      resolvedFormatted = geo.formatted ?? resolvedFormatted;
      resolvedPlaceId = geo.placeId ?? resolvedPlaceId;
    }
  }

  if (resolvedLat != null && resolvedLng != null) {
    await admin.rpc("update_property_geo", {
      p_property_id: propertyId,
      p_latitude: resolvedLat,
      p_longitude: resolvedLng,
      p_place_id: resolvedPlaceId ?? null,
      p_address_formatted: resolvedFormatted ?? null,
      p_address_components: addressComponents ?? null,
      p_geo_accuracy_m: body.geo_accuracy_m ?? null,
      p_address_validated: false,
    });

    // Coastline heuristic: within ~5km of sea level grid (simplified — lat/lng near coast UK/EU)
    // For MVP: emit geocoded success signal only; property intelligence rules expand later
    await emitSignal(admin, {
      org_id: resolvedOrgId,
      property_id: propertyId,
      subtype: "property.geocoded",
      title: "Property location confirmed",
      body: `${property.nickname || property.address} is ready for environmental monitoring.`,
      category: "property",
      kind: "system",
      severity: "info",
      source: "google_geocoding",
      payload: { lat: resolvedLat, lng: resolvedLng, place_id: resolvedPlaceId },
      dedupe_key: propertyDedupeKey(propertyId, "property.geocoded"),
    });

    return jsonResponse({
      ok: true,
      latitude: resolvedLat,
      longitude: resolvedLng,
      place_id: resolvedPlaceId,
    });
  }

  await emitSignal(admin, {
    org_id: resolvedOrgId,
    property_id: propertyId,
    subtype: "property.geocode_failed",
    title: "Property address could not be geocoded",
    body: "Update the property address to enable weather and environmental signals.",
    category: "property",
    kind: "system",
    severity: "warning",
    source: "google_geocoding",
    disposition: "needs_review",
    dedupe_key: propertyDedupeKey(propertyId, "property.geocode_failed"),
  });

  return jsonResponse({ error: "Geocoding failed" }, 422);
});
