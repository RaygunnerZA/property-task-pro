// ai-actions-create-compliance — Create compliance record from AI detection + link to attachment
// Phase 4: User-confirmed compliance creation from image analysis

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  org_id: string;
  property_id?: string | null; // compliance_documents is org-scoped; used for context if needed
  title: string;
  compliance_type?: string | null;
  expiry_date?: string | null;
  attachment_id?: string | null;
}

function computeStatus(expiryDate: string | null | undefined): string {
  if (!expiryDate) return "unknown";
  const exp = new Date(expiryDate);
  const now = new Date();
  const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return "red";
  if (daysLeft < 60) return "amber";
  return "green";
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "POST only" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { org_id, title, compliance_type, expiry_date, attachment_id } = body;

    if (!org_id || !title?.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: org_id, title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Service role not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const status = computeStatus(expiry_date);
    const displayTitle = compliance_type ? `${compliance_type}: ${title.trim()}` : title.trim();

    const { data: compliance, error: complianceError } = await admin
      .from("compliance_documents")
      .insert({
        org_id,
        title: displayTitle,
        expiry_date: expiry_date || null,
        status,
      })
      .select()
      .single();

    if (complianceError) {
      console.error("ai-actions-create-compliance error:", complianceError);
      return new Response(
        JSON.stringify({ error: complianceError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (compliance && attachment_id) {
      await admin.from("attachment_compliance").insert({
        attachment_id,
        compliance_document_id: compliance.id,
        org_id,
      });
    }

    return new Response(JSON.stringify(compliance), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-actions-create-compliance error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
