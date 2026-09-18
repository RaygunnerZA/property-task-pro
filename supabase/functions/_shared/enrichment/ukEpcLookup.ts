import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  UK_EPC_PROVIDER,
  isWithinCooldown,
  mapDomesticSearchRow,
  shouldLookupUkEpc,
  type UkEpcStatus,
} from "./ukEpc.ts";

const EPC_API_BASE = "https://api.get-energy-performance-data.communities.gov.uk";
const EPC_SEARCH_PATH = "/api/domestic/search";
const EPC_CERTIFICATE_PATH = "/api/certificate";
const FETCH_TIMEOUT_MS = 12_000;

type ExistingEnrichment = {
  status: string;
  retrieved_at: string;
};

export function normaliseEpcBearerToken(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/^Bearer\s+/i, "").trim() || undefined;
}

export async function maybeEnrichUkEpc(input: {
  admin: SupabaseClient;
  orgId: string;
  propertyId: string;
  countryCode: string | null;
  postalCode: string | null;
  token: string | undefined;
  now?: Date;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  if (!shouldLookupUkEpc({ countryCode: input.countryCode, postalCode: input.postalCode })) {
    return;
  }

  const token = normaliseEpcBearerToken(input.token);
  if (!token) return;

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
      token,
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

function unwrapRecords(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) {
    return json.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
  }
  if (!json || typeof json !== "object") return [];
  const obj = json as Record<string, unknown>;
  for (const key of ["data", "rows", "results", "certificates"]) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return [value as Record<string, unknown>];
    }
  }
  return [obj];
}

async function epcGet(
  path: string,
  params: Record<string, string>,
  token: string,
  fetchImpl: typeof fetch
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const url = new URL(path, EPC_API_BASE);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    if (res.status === 404) {
      return { ok: true, status: 404, json: null };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, json: null };
    }
    return { ok: true, status: res.status, json: await res.json() };
  } finally {
    clearTimeout(timer);
  }
}

async function searchDomesticEpc(input: {
  postcode: string;
  token: string;
  fetchImpl: typeof fetch;
}): Promise<{ status: UkEpcStatus; sourceId: string | null; facts: Record<string, unknown> }> {
  const search = await epcGet(EPC_SEARCH_PATH, { postcode: input.postcode }, input.token, input.fetchImpl);
  if (!search.ok) {
    return { status: "error", sourceId: null, facts: {} };
  }
  if (search.status === 404) {
    return { status: "not_found", sourceId: null, facts: {} };
  }

  const rows = unwrapRecords(search.json);
  const first = rows[0];
  if (!first) {
    return { status: "not_found", sourceId: null, facts: {} };
  }

  let mapped = mapDomesticSearchRow(first);
  const certificateNumber = mapped.sourceId;
  if (certificateNumber) {
    const detail = await epcGet(
      EPC_CERTIFICATE_PATH,
      { certificate_number: certificateNumber },
      input.token,
      input.fetchImpl
    );
    if (detail.ok && detail.status !== 404 && detail.json) {
      const detailMapped = mapDomesticSearchRow(unwrapRecords(detail.json)[0] ?? (detail.json as Record<string, unknown>));
      mapped = {
        sourceId: detailMapped.sourceId ?? mapped.sourceId,
        facts: { ...mapped.facts, ...detailMapped.facts },
      };
    }
  }

  return {
    status: "found",
    sourceId: mapped.sourceId,
    facts: mapped.facts,
  };
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
