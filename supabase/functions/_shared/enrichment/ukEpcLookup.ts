import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  UK_EPC_PROVIDER,
  isWithinCooldown,
  mapDomesticSearchRow,
  shouldLookupUkEpc,
  type UkEpcStatus,
} from "./ukEpc.ts";

const EPC_SEARCH_URL = "https://epc.opendatacommunities.org/api/v1/domestic/search";
const FETCH_TIMEOUT_MS = 12_000;

type ExistingEnrichment = {
  status: string;
  retrieved_at: string;
};

export async function maybeEnrichUkEpc(input: {
  admin: SupabaseClient;
  orgId: string;
  propertyId: string;
  countryCode: string | null;
  postalCode: string | null;
  email: string | undefined;
  apiKey: string | undefined;
  now?: Date;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  if (!shouldLookupUkEpc({ countryCode: input.countryCode, postalCode: input.postalCode })) {
    return;
  }

  const email = input.email?.trim();
  const apiKey = input.apiKey?.trim();
  if (!email || !apiKey) return;

  const now = input.now ?? new Date();
  const { data: existing } = await input.admin
    .from("property_enrichments")
    .select("status, retrieved_at")
    .eq("property_id", input.propertyId)
    .eq("provider", UK_EPC_PROVIDER)
    .maybeSingle();

  const row = existing as ExistingEnrichment | null;
  if (
    row &&
    (row.status === "found" || row.status === "not_found") &&
    isWithinCooldown(row.retrieved_at, now.getTime())
  ) {
    return;
  }

  try {
    const result = await searchDomesticEpc({
      postcode: input.postalCode!,
      email,
      apiKey,
      fetchImpl: input.fetchImpl ?? fetch,
    });

    if (result.status === "error" && row?.status === "found") {
      console.error(JSON.stringify({ event: "uk_epc_lookup_failed_kept_found", property_id: input.propertyId }));
      return;
    }

    await upsertEnrichment(input.admin, {
      orgId: input.orgId,
      propertyId: input.propertyId,
      status: result.status,
      sourceId: result.sourceId,
      facts: result.facts,
      retrievedAt: now.toISOString(),
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "uk_epc_lookup_error",
        property_id: input.propertyId,
        message: err instanceof Error ? err.message : String(err),
      })
    );
    if (row?.status === "found") return;
    await upsertEnrichment(input.admin, {
      orgId: input.orgId,
      propertyId: input.propertyId,
      status: "error",
      sourceId: null,
      facts: {},
      retrievedAt: now.toISOString(),
    });
  }
}

async function searchDomesticEpc(input: {
  postcode: string;
  email: string;
  apiKey: string;
  fetchImpl: typeof fetch;
}): Promise<{ status: UkEpcStatus; sourceId: string | null; facts: Record<string, unknown> }> {
  const url = new URL(EPC_SEARCH_URL);
  url.searchParams.set("postcode", input.postcode);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const token = btoa(`${input.email}:${input.apiKey}`);
    const res = await input.fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${token}`,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      return { status: "error", sourceId: null, facts: {} };
    }

    const json = (await res.json()) as { rows?: unknown };
    const rows = Array.isArray(json.rows) ? json.rows : [];
    const first = rows[0];
    if (!first || typeof first !== "object") {
      return { status: "not_found", sourceId: null, facts: {} };
    }

    const mapped = mapDomesticSearchRow(first as Record<string, unknown>);
    return {
      status: "found",
      sourceId: mapped.sourceId,
      facts: mapped.facts,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function upsertEnrichment(
  admin: SupabaseClient,
  input: {
    orgId: string;
    propertyId: string;
    status: UkEpcStatus;
    sourceId: string | null;
    facts: Record<string, unknown>;
    retrievedAt: string;
  }
): Promise<void> {
  const { error } = await admin.from("property_enrichments").upsert(
    {
      org_id: input.orgId,
      property_id: input.propertyId,
      provider: UK_EPC_PROVIDER,
      status: input.status,
      source_id: input.sourceId,
      facts: input.facts,
      retrieved_at: input.retrievedAt,
      updated_at: input.retrievedAt,
    },
    { onConflict: "property_id,provider" }
  );
  if (error) {
    console.error(JSON.stringify({ event: "uk_epc_upsert_error", message: error.message }));
  }
}
