/**
 * knowledge-generate-guidance — draft or improve homeowner-readable guidance.
 * Never verifies or publishes. When persist=false, returns proposed text only.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geminiUsage, openAiUsage } from "../_shared/aiObservability.ts";
import { runCapability, type ExecutorOutput } from "../_shared/aiCall.ts";
import {
  knowledgeGeminiApiKey,
  geminiGenerateContentUrl,
  GEMINI_FLASH_MODEL,
} from "../_shared/geminiKeys.ts";
import { parseJsonLoose, TimeoutError } from "../_shared/aiRouting.ts";
import {
  buildGuidanceUserPayload,
  guidanceSystemForMode,
  validateDraft,
  type GuidanceDraft,
} from "../_shared/knowledgeGuidanceDraft.ts";

type ErrorBody = {
  ok: false;
  code: string;
  message: string;
  request_id: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

function newRequestId(): string {
  return crypto.randomUUID();
}

function jsonOk(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonErr(
  status: number,
  code: string,
  message: string,
  requestId: string,
  logDetail?: Record<string, unknown>
) {
  console.error("[knowledge-generate-guidance]", {
    request_id: requestId,
    code,
    status,
    ...logDetail,
  });
  const body: ErrorBody = { ok: false, code, message, request_id: requestId };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callOpenAI(
  apiKey: string,
  system: string,
  payload: string
): Promise<ExecutorOutput> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: payload },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`OpenAI ${res.status}: ${text.slice(0, 240)}`);
    (err as Error & { providerStatus?: number }).providerStatus = res.status;
    throw err;
  }
  const data = await res.json();
  return { raw: parseJsonLoose(data?.choices?.[0]?.message?.content), usage: openAiUsage(data) };
}

async function callGemini(
  apiKey: string,
  system: string,
  payload: string
): Promise<ExecutorOutput> {
  const url = geminiGenerateContentUrl(GEMINI_FLASH_MODEL, apiKey);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${system}\n\n${payload}` }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Gemini ${res.status}: ${text.slice(0, 240)}`);
    (err as Error & { providerStatus?: number }).providerStatus = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return { raw: parseJsonLoose(text), usage: geminiUsage(data) };
}

function mapProviderFailure(err: string | undefined): {
  status: number;
  code: string;
  message: string;
} {
  const msg = err ?? "generation_failed";
  if (/429|rate limit|quota/i.test(msg)) {
    return {
      status: 429,
      code: "provider_rate_limited",
      message:
        "The AI provider rejected the request due to its rate limit. Try again later.",
    };
  }
  if (/timeout|TimeoutError/i.test(msg)) {
    return {
      status: 504,
      code: "provider_timeout",
      message: "The AI provider timed out. Try again in a moment.",
    };
  }
  if (/API key not set|OPENAI_API_KEY|Gemini API key/i.test(msg)) {
    return {
      status: 500,
      code: "ai_provider_not_configured",
      message: "Guidance could not be improved because no AI provider is configured.",
    };
  }
  if (/no eligible strategy|no_ai_provider/i.test(msg)) {
    return {
      status: 500,
      code: "ai_provider_not_configured",
      message: "Guidance could not be improved because no AI provider is configured.",
    };
  }
  return {
    status: 502,
    code: "ai_provider_failed",
    message: "The AI provider failed to generate improved guidance. Try again later.",
  };
}

Deno.serve(async (req) => {
  const requestId = newRequestId();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    if (!serviceKey || !supabaseUrl) {
      return jsonErr(
        500,
        "server_misconfigured",
        "Guidance service is misconfigured.",
        requestId,
        { missing: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !Deno.env.get(k)) }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonErr(
        401,
        "unauthorized",
        "Sign in again to improve guidance.",
        requestId
      );
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      return jsonErr(401, "unauthorized", "Sign in again to improve guidance.", requestId);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Prefer service-role getUser(jwt) — does not depend on anon-key client wiring.
    let userId: string;
    try {
      const { data: userData, error: userErr } = await admin.auth.getUser(token);
      if (userErr || !userData.user) {
        return jsonErr(
          401,
          "unauthorized",
          "Sign in again to improve guidance.",
          requestId,
          { auth_error: userErr?.message ?? "no_user" }
        );
      }
      userId = userData.user.id;
    } catch (e) {
      return jsonErr(
        401,
        "unauthorized",
        "Sign in again to improve guidance.",
        requestId,
        { auth_error: e instanceof Error ? e.message : "auth_exception" }
      );
    }

    const { data: adminRow, error: adminErr } = await admin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (adminErr) {
      return jsonErr(
        500,
        "admin_check_failed",
        "Could not verify admin permission.",
        requestId,
        { db_error: adminErr.message }
      );
    }
    if (!adminRow) {
      return jsonErr(
        403,
        "not_platform_admin",
        "Only platform admins can generate or improve guidance.",
        requestId
      );
    }

    let body: {
      knowledge_id?: string;
      knowledge_ids?: string[];
      mode?: "generate" | "improve";
      persist?: boolean;
    };
    try {
      body = await req.json();
    } catch {
      return jsonErr(400, "invalid_json", "Request body must be JSON.", requestId);
    }

    const mode = body.mode === "improve" ? "improve" : "generate";
    const persist = body.persist !== false;
    const system = guidanceSystemForMode(mode);

    const ids = [
      ...(body.knowledge_id ? [body.knowledge_id] : []),
      ...(Array.isArray(body.knowledge_ids) ? body.knowledge_ids : []),
    ].filter(Boolean);
    const uniqueIds = [...new Set(ids)].slice(0, 40);
    if (uniqueIds.length === 0) {
      return jsonErr(
        400,
        "knowledge_id_required",
        "Select a Knowledge record to improve.",
        requestId
      );
    }

    // Single-record path: fail closed with HTTP error codes (batch soft-fails per id).
    const single = uniqueIds.length === 1;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const geminiKey = knowledgeGeminiApiKey();

    const results: Array<{
      id: string;
      ok: boolean;
      error?: string;
      code?: string;
      summary?: string;
      persisted?: boolean;
    }> = [];

    for (const knowledge_id of uniqueIds) {
      const { data: row, error: loadErr } = await admin
        .from("knowledge")
        .select("*")
        .eq("id", knowledge_id)
        .maybeSingle();

      if (loadErr) {
        if (single) {
          return jsonErr(500, "knowledge_load_failed", "Could not load Knowledge.", requestId, {
            knowledge_id,
            db_error: loadErr.message,
          });
        }
        results.push({ id: knowledge_id, ok: false, error: loadErr.message, code: "knowledge_load_failed" });
        continue;
      }
      if (!row) {
        if (single) {
          return jsonErr(404, "knowledge_not_found", "Knowledge record not found.", requestId, {
            knowledge_id,
          });
        }
        results.push({ id: knowledge_id, ok: false, error: "knowledge_not_found", code: "knowledge_not_found" });
        continue;
      }
      if (row.status !== "candidate") {
        if (single) {
          return jsonErr(
            409,
            "not_candidate",
            "Only candidate Knowledge can receive draft guidance.",
            requestId,
            { knowledge_id, status: row.status }
          );
        }
        results.push({ id: knowledge_id, ok: false, error: "not_candidate", code: "not_candidate" });
        continue;
      }

      const { data: sourceRows } = await admin
        .from("knowledge_sources")
        .select("label, url, source_type, metadata")
        .eq("knowledge_id", knowledge_id);

      const linkedSources = (sourceRows ?? []).filter(
        (s) => typeof s.url === "string" && /^https?:\/\//i.test(s.url)
      );

      const payload = buildGuidanceUserPayload({
        mode,
        title: row.title,
        summary: row.summary,
        body: row.body,
        attributes: (row.attributes as Record<string, unknown>) ?? {},
        applicability: row.applicability,
        linkedSources,
      });

      const isPlatform = row.scope === "platform" || row.org_id == null;
      const logOrg = row.org_id ?? "00000000-0000-0000-0000-000000000000";

      const run = await runCapability<GuidanceDraft>(admin, {
        capability: "knowledge_guidance_draft",
        orgId: logOrg,
        userId,
        entity: { type: "knowledge", id: knowledge_id },
        metadata: {
          purpose: mode === "improve" ? "improve_guidance" : "draft_guidance",
          request_id: requestId,
        },
        allowFallback: true,
        skipGate: isPlatform,
        executors: {
          "model:gemini-2.0-flash": () => {
            if (!geminiKey) throw new Error("Gemini API key not set");
            return callGemini(geminiKey, system, payload);
          },
          "model:gpt-4o-mini": () => {
            if (!openaiKey) throw new Error("OPENAI_API_KEY not set");
            return callOpenAI(openaiKey, system, payload);
          },
        },
        validate: validateDraft,
      });

      if (!run.ok || !run.value) {
        const mapped = mapProviderFailure(run.error);
        if (single) {
          return jsonErr(mapped.status, mapped.code, mapped.message, requestId, {
            knowledge_id,
            provider_error: run.error,
          });
        }
        results.push({
          id: knowledge_id,
          ok: false,
          error: run.error ?? mapped.code,
          code: mapped.code,
        });
        continue;
      }

      if (!persist) {
        results.push({
          id: knowledge_id,
          ok: true,
          summary: run.value.summary,
          persisted: false,
        });
        continue;
      }

      if (!anonKey) {
        if (single) {
          return jsonErr(
            500,
            "server_misconfigured",
            "Guidance service cannot save drafts (API key missing).",
            requestId
          );
        }
        results.push({
          id: knowledge_id,
          ok: false,
          error: "anon_key_missing",
          code: "server_misconfigured",
        });
        continue;
      }

      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const draftMeta = {
        source: "ai",
        mode,
        proposed_at: new Date().toISOString(),
        supported_by: [
          "structured_record",
          ...(linkedSources.length ? ["linked_sources"] : []),
          ...(mode === "improve" ? ["existing_guidance"] : []),
        ],
        model: run.strategy?.model ?? null,
        provider: run.strategy?.provider ?? null,
        unverified: true,
        label: "AI-proposed draft",
      };

      const { error: applyErr } = await userClient.rpc("admin_set_knowledge_draft_guidance", {
        p_knowledge_id: knowledge_id,
        p_summary: run.value.summary,
        p_body: null,
        p_draft_meta: draftMeta,
      });

      if (applyErr) {
        if (single) {
          return jsonErr(
            500,
            "draft_save_failed",
            "Improved guidance was generated but could not be saved.",
            requestId,
            { knowledge_id, db_error: applyErr.message }
          );
        }
        results.push({
          id: knowledge_id,
          ok: false,
          error: applyErr.message,
          code: "draft_save_failed",
        });
        continue;
      }

      results.push({
        id: knowledge_id,
        ok: true,
        summary: run.value.summary,
        persisted: true,
      });
    }

    return jsonOk({
      ok: results.every((r) => r.ok),
      results,
      generated: results.filter((r) => r.ok).length,
      mode,
      request_id: requestId,
    });
  } catch (e) {
    if (e instanceof TimeoutError) {
      return jsonErr(
        504,
        "provider_timeout",
        "The AI provider timed out. Try again in a moment.",
        requestId
      );
    }
    return jsonErr(
      500,
      "internal_error",
      "An unexpected error occurred while improving guidance.",
      requestId,
      { error: e instanceof Error ? e.message : "unknown" }
    );
  }
});
