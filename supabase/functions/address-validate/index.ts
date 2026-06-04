// address-validate — Google Address Validation + duplicate detection signals
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/geoUtils.ts";
import { emitSignal, propertyDedupeKey } from "../_shared/signalEngine.ts";

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
  const orgId = body.org_id as string;
  const address = (body.address as string)?.trim();
  const propertyId = body.property_id as string | undefined;

  if (!orgId || !address) {
    return jsonResponse({ error: "org_id and address required" }, 400);
  }

  const results: { valid: boolean; signals: string[]; formatted?: string } = {
    valid: true,
    signals: [],
  };

  // Duplicate check
  const { data: dup } = await admin.rpc("check_duplicate_property_address", {
    p_org_id: orgId,
    p_address: address,
  });
  if (dup === true) {
    results.valid = false;
    results.signals.push("property.duplicate_detected");
    await emitSignal(admin, {
      org_id: orgId,
      property_id: propertyId,
      subtype: "property.duplicate_detected",
      title: "Possible duplicate property",
      body: `A property with a similar address already exists: ${address}`,
      category: "property",
      kind: "system",
      severity: "warning",
      source: "address_validation",
      disposition: "needs_review",
      dedupe_key: `${orgId}:dup:${address.toLowerCase()}`,
    });
  }

  if (apiKey) {
    const res = await fetch(
      `https://addressvalidation.googleapis.com/v1:validateAddress?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: { addressLines: [address] },
        }),
      }
    );

    if (res.ok) {
      const json = await res.json();
      const verdict = json.result?.verdict;
      const formatted = json.result?.address?.formattedAddress;
      if (formatted) results.formatted = formatted;

      const hasUnconfirmed = verdict?.hasUnconfirmedComponents === true;
      const invalid = verdict?.addressComplete === false;

      if (invalid || hasUnconfirmed) {
        results.valid = false;
        results.signals.push("property.invalid_address");
        await emitSignal(admin, {
          org_id: orgId,
          property_id: propertyId,
          subtype: "property.invalid_address",
          title: "Invalid property address detected",
          body: `Address may be incomplete or unconfirmed: ${address}`,
          category: "property",
          kind: "system",
          severity: "warning",
          source: "google_address_validation",
          disposition: "needs_review",
          payload: { verdict },
          dedupe_key: `${orgId}:invalid:${address.toLowerCase()}`,
        });
      } else if (propertyId) {
        await admin.rpc("update_property_geo", {
          p_property_id: propertyId,
          p_address_formatted: formatted ?? null,
          p_address_validated: true,
        });
      }
    }
  } else if (!address) {
    results.valid = false;
    results.signals.push("property.missing_location_data");
    await emitSignal(admin, {
      org_id: orgId,
      property_id: propertyId,
      subtype: "property.missing_location_data",
      title: "Property missing location data",
      body: "Add or validate the property address to enable environmental signals.",
      category: "property",
      kind: "system",
      severity: "info",
      source: "address_validation",
      dedupe_key: propertyId
        ? propertyDedupeKey(propertyId, "property.missing_location_data")
        : `${orgId}:missing_location`,
    });
  }

  return jsonResponse(results);
});
