// ai-doc-reanalyse — Phase 5: Bulk re-analysis for property documents
// Processes all attachments for a property; skips recent analyses unless overwrite=true

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RECENT_DAYS = 30;

interface RequestBody {
  org_id: string;
  property_id: string;
  overwrite?: boolean;
}

interface ProgressResult {
  total: number;
  completed: number;
  skipped: number;
  errors: number;
  error_details?: string[];
}

function isRecentlyAnalysed(att: { metadata?: Record<string, unknown> }): boolean {
  const meta = att.metadata as Record<string, unknown> | undefined;
  const analysedAt = meta?.analysed_at as string | undefined;
  if (!analysedAt) return false;
  const analysed = new Date(analysedAt);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_DAYS);
  return analysed >= cutoff;
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ ok: false, error: "POST only" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { org_id, property_id, overwrite = false } = body;

    if (!org_id || !property_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing org_id or property_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "Service role not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: attachments, error: fetchError } = await admin
      .from("attachments")
      .select("id, file_url, file_name, metadata")
      .eq("org_id", org_id)
      .eq("parent_type", "property")
      .eq("parent_id", property_id);

    if (fetchError) {
      return new Response(
        JSON.stringify({ ok: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toProcess = (attachments || []).filter(
      (a) => overwrite || !isRecentlyAnalysed(a)
    );
    const skipped = (attachments || []).length - toProcess.length;

    const result: ProgressResult = {
      total: (attachments || []).length,
      completed: 0,
      skipped,
      errors: 0,
      error_details: [],
    };

    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey;

    for (const att of toProcess) {
      if (!att.file_url || !att.file_name) {
        result.skipped++;
        continue;
      }

      try {
        const res = await fetch(`${baseUrl}/functions/v1/ai-doc-analyse`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            file_url: att.file_url,
            file_name: att.file_name,
            property_id,
            org_id,
            attachment_id: att.id,
            overwrite: true,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText);
        }
        result.completed++;
      } catch (err) {
        result.errors++;
        result.error_details = result.error_details || [];
        result.error_details.push(`${att.file_name}: ${String(err)}`);
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-doc-reanalyse error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
