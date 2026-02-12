// ai-actions-create-asset — Create asset from AI detection + link to attachment
// Phase 4: User-confirmed asset creation from image analysis

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  org_id: string;
  property_id: string;
  space_id?: string | null;
  name: string;
  category?: string | null;
  serial_number?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  install_date?: string | null;
  warranty_expiry?: string | null;
  detected_from_attachment_id?: string | null;
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

    const {
      org_id,
      property_id,
      space_id,
      name,
      category,
      serial_number,
      manufacturer,
      model,
      install_date,
      warranty_expiry,
      detected_from_attachment_id,
    } = body;

    if (!org_id || !property_id || !name?.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: org_id, property_id, name" }),
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

    const { data: asset, error: assetError } = await admin
      .from("assets")
      .insert({
        org_id,
        property_id,
        space_id: space_id || null,
        name: name.trim(),
        asset_type: category || null,
        serial_number: serial_number?.trim() || null,
        manufacturer: manufacturer?.trim() || null,
        model: model?.trim() || null,
        install_date: install_date || null,
        warranty_expiry: warranty_expiry || null,
        condition_score: 100,
        status: "active",
      })
      .select()
      .single();

    if (assetError) {
      console.error("ai-actions-create-asset error:", assetError);
      return new Response(
        JSON.stringify({ error: assetError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (asset && detected_from_attachment_id) {
      await admin.from("attachment_assets").insert({
        attachment_id: detected_from_attachment_id,
        asset_id: asset.id,
        org_id,
      });
    }

    return new Response(JSON.stringify(asset), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-actions-create-asset error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
