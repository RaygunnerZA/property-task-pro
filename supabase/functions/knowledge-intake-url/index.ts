/**
 * knowledge-intake-url — safe URL fetch for Knowledge intake, then ai-doc-analyse extraction.
 * Platform admin only. Does not create Knowledge rows (proposals returned to client).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeFetchUrl } from "../_shared/safeUrlFetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_AI_ORG = "00000000-0000-0000-0000-000000000000";

interface RequestBody {
  url: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extForContentType(ct: string, fileName: string): string {
  if (fileName.includes(".")) return fileName.split(".").pop()!.toLowerCase();
  if (ct.includes("pdf")) return "pdf";
  if (ct.includes("html")) return "html";
  if (ct.includes("plain")) return "txt";
  if (ct.includes("jpeg")) return "jpg";
  if (ct.includes("png")) return "png";
  return "bin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const sourceUrl = body.url?.trim();
  if (!sourceUrl) return json({ ok: false, error: "url_required" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ ok: false, error: "server_misconfigured" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) return json({ ok: false, error: "unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: isAdmin, error: adminErr } = await userClient.rpc("is_platform_admin");
  if (adminErr || !isAdmin) return json({ ok: false, error: "not_platform_admin" }, 403);

  let fetched: Awaited<ReturnType<typeof safeFetchUrl>>;
  try {
    fetched = await safeFetchUrl(sourceUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "url_fetch_failed";
    return json({ ok: false, error: msg }, 400);
  }

  const retrievedAt = new Date().toISOString();
  const ext = extForContentType(fetched.contentType, fetched.fileName);
  const safeName = `${fetched.fileName.replace(/\.[^.]+$/, "")}.${ext}`.slice(0, 120);
  const storagePath = `platform/${user.id}/url-${crypto.randomUUID()}-${safeName}`;

  const { error: uploadErr } = await admin.storage
    .from("knowledge-intake")
    .upload(storagePath, fetched.bytes, {
      contentType: fetched.contentType,
      upsert: false,
    });
  if (uploadErr) return json({ ok: false, error: uploadErr.message }, 500);

  const { data: signed, error: signErr } = await admin.storage
    .from("knowledge-intake")
    .createSignedUrl(storagePath, 3600);
  if (signErr || !signed?.signedUrl) {
    return json({ ok: false, error: signErr?.message ?? "signed_url_failed" }, 500);
  }

  const analyseRes = await fetch(`${supabaseUrl}/functions/v1/ai-doc-analyse`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file_url: signed.signedUrl,
      file_name: safeName,
      org_id: PLATFORM_AI_ORG,
      knowledge_intake: true,
    }),
  });

  const analysis = await analyseRes.json();
  if (!analyseRes.ok) {
    return json({ ok: false, error: analysis?.error ?? "analysis_failed" }, 502);
  }

  return json({
    ok: true,
    storage: {
      bucket: "knowledge-intake",
      path: storagePath,
      filename: safeName,
      mime: fetched.contentType,
    },
    source: {
      source_url: sourceUrl,
      final_url: fetched.finalUrl,
      retrieved_date: retrievedAt,
      source_document: safeName,
    },
    analysis,
  });
});
