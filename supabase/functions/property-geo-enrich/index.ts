// property-geo-enrich — geocode property (authorised) then fail-soft UK EPC enrichment
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/geoUtils.ts";
import { extractCountryAndPostcode } from "../_shared/enrichment/addressComponents.ts";
import { maybeEnrichUkEpc } from "../_shared/enrichment/ukEpcLookup.ts";
import {
  emitSignal,
  geocodeAddress,
  propertyDedupeKey,
} from "../_shared/signalEngine.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "POST only" }, 405);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Service not configured" }, 500);
  }

  const body = await req.json().catch(() => ({}));
  const propertyId = typeof body.property_id === "string" ? body.property_id.trim() : "";
  if (!UUID_RE.test(propertyId)) {
    return jsonResponse({ error: "property_id required" }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: property, error: propErr } = await userClient
    .from("properties")
    .select("id, org_id, address")
    .eq("id", propertyId)
    .maybeSingle();

  if (propErr || !property?.org_id) {
    return jsonResponse({ error: "Property not found" }, 404);
  }

  const orgId = property.org_id as string;
  const apiKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY");
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const address = typeof body.address === "string" ? body.address : undefined;
  const placeId = typeof body.place_id === "string" ? body.place_id : undefined;
  const lat = typeof body.latitude === "number" ? body.latitude : undefined;
  const lng = typeof body.longitude === "number" ? body.longitude : undefined;
  const addressFormatted =
    typeof body.address_formatted === "string" ? body.address_formatted : undefined;
  const clientComponents = body.address_components;

  let resolvedLat = lat;
  let resolvedLng = lng;
  let resolvedFormatted = addressFormatted;
  let resolvedPlaceId = placeId;
  let resolvedComponents = clientComponents;

  if ((resolvedLat == null || resolvedLng == null) && apiKey) {
    const query = address ?? property.address;
    const geo = await geocodeAddress(query, apiKey);
    if (geo) {
      resolvedLat = geo.lat;
      resolvedLng = geo.lng;
      resolvedFormatted = geo.formatted ?? resolvedFormatted;
      resolvedPlaceId = geo.placeId ?? resolvedPlaceId;
      if (!Array.isArray(resolvedComponents) || resolvedComponents.length === 0) {
        resolvedComponents = geo.addressComponents;
      }
    }
  }

  if (resolvedLat != null && resolvedLng != null) {
    const { countryCode, postalCode } = extractCountryAndPostcode(resolvedComponents);

    await admin.rpc("update_property_geo", {
      p_property_id: propertyId,
      p_latitude: resolvedLat,
      p_longitude: resolvedLng,
      p_place_id: resolvedPlaceId ?? null,
      p_address_formatted: resolvedFormatted ?? null,
      p_address_components: resolvedComponents ?? null,
      p_geo_accuracy_m: typeof body.geo_accuracy_m === "number" ? body.geo_accuracy_m : null,
      p_address_validated: false,
      p_country_code: countryCode,
      p_postal_code: postalCode,
    });

    try {
      await maybeEnrichUkEpc({
        admin,
        orgId,
        propertyId,
        countryCode,
        postalCode,
        email: Deno.env.get("UK_EPC_API_EMAIL"),
        apiKey: Deno.env.get("UK_EPC_API_KEY"),
      });
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "uk_epc_enrich_failed",
          property_id: propertyId,
          message: err instanceof Error ? err.message : String(err),
        })
      );
    }

    return jsonResponse({
      ok: true,
      latitude: resolvedLat,
      longitude: resolvedLng,
      place_id: resolvedPlaceId,
    });
  }

  await emitSignal(admin, {
    org_id: orgId,
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
