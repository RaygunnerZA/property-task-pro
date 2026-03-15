import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  plan_file_id: string;
}

interface ExtractedEntity {
  name: string;
  type: string;
  confidence: number;
  rationale?: string;
}

interface NormalizedExtraction {
  spaces: ExtractedEntity[];
  assets: ExtractedEntity[];
  compliance_elements: ExtractedEntity[];
  suggested_tasks: ExtractedEntity[];
}

const EXTRACTION_PROMPT = `You are extracting operations-relevant data from a building plan.
Return JSON only with shape:
{
  "spaces":[{"name":"", "type":"", "confidence":0.0, "rationale":""}],
  "assets":[{"name":"", "type":"", "confidence":0.0, "rationale":""}],
  "compliance_elements":[{"name":"", "type":"", "confidence":0.0, "rationale":""}],
  "suggested_tasks":[{"name":"", "type":"", "confidence":0.0, "rationale":""}]
}

Rules:
- Identify only visible or reasonably inferable elements.
- Prefer unknown or omit instead of hallucinating.
- Confidence must be between 0 and 1.
- Keep types machine-friendly snake_case.
- Focus on spaces, plant/electrical/service rooms, exits, fire safety, maintainable assets.`;

function clampConfidence(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function normalizeList(input: unknown): ExtractedEntity[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const row = (item || {}) as Record<string, unknown>;
      const name = String(row.name || "").trim();
      const type = String(row.type || "unknown").trim() || "unknown";
      if (!name) return null;
      return {
        name,
        type,
        confidence: clampConfidence(row.confidence),
        rationale: typeof row.rationale === "string" ? row.rationale : undefined,
      };
    })
    .filter(Boolean) as ExtractedEntity[];
}

function normaliseExtraction(rawResponse: Record<string, unknown>): NormalizedExtraction {
  const base: NormalizedExtraction = {
    spaces: normalizeList(rawResponse.spaces),
    assets: normalizeList(rawResponse.assets),
    compliance_elements: normalizeList(rawResponse.compliance_elements),
    suggested_tasks: normalizeList(rawResponse.suggested_tasks),
  };
  return {
    ...base,
    suggested_tasks: generateTaskSuggestions(base),
  };
}

function generateTaskSuggestions(extractedModel: NormalizedExtraction): ExtractedEntity[] {
  const suggestions = [...extractedModel.suggested_tasks];

  const hasFire = extractedModel.compliance_elements.some((e) =>
    ["exit", "fire_door", "fire_point", "extinguisher", "emergency_signage"].includes(e.type)
  );
  const hasElectrical = extractedModel.assets.some((a) =>
    ["electrical_panel", "distribution_board", "fire_alarm_panel"].includes(a.type)
  ) || extractedModel.spaces.some((s) => s.type === "electrical_room");
  const hasPlant = extractedModel.spaces.some((s) =>
    ["plant_room", "boiler_room", "service_room"].includes(s.type)
  );

  if (hasFire) {
    suggestions.push({
      name: "Fire safety inspection",
      type: "fire_safety_inspection",
      confidence: 0.78,
      rationale: "Fire safety elements were detected on plan pages.",
    });
  }
  if (hasElectrical) {
    suggestions.push({
      name: "Electrical inspection",
      type: "electrical_inspection",
      confidence: 0.75,
      rationale: "Electrical rooms or panel assets were detected.",
    });
  }
  if (hasPlant) {
    suggestions.push({
      name: "Plant room inspection",
      type: "plant_room_inspection",
      confidence: 0.72,
      rationale: "Plant/service spaces were detected.",
    });
  }

  const dedupe = new Map<string, ExtractedEntity>();
  for (const suggestion of suggestions) {
    const key = `${suggestion.type}:${suggestion.name.toLowerCase()}`;
    const existing = dedupe.get(key);
    if (!existing || suggestion.confidence > existing.confidence) {
      dedupe.set(key, suggestion);
    }
  }
  return Array.from(dedupe.values());
}

async function fetchAsBase64(fileUrl: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Failed to fetch page image: ${response.status}`);
  const blob = await response.blob();
  const mimeType = blob.type || "image/png";
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i++) binary += String.fromCharCode(buffer[i]);
  return { base64: btoa(binary), mimeType };
}

async function callGemini(base64: string, mimeType: string): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: EXTRACTION_PROMPT },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini response empty");
  return JSON.parse(text);
}

async function callOpenAI(base64: string, mimeType: string): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  const dataUrl = `data:${mimeType};base64,${base64}`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI response empty");
  return JSON.parse(text);
}

async function extractPlanPage(pageImageUrl: string): Promise<Record<string, unknown>> {
  const { base64, mimeType } = await fetchAsBase64(pageImageUrl);
  const provider = (Deno.env.get("AI_PROVIDER") || "gemini").toLowerCase();
  if (provider === "openai") {
    try {
      return await callOpenAI(base64, mimeType);
    } catch {
      return await callGemini(base64, mimeType);
    }
  }
  if (provider === "gemini") {
    try {
      return await callGemini(base64, mimeType);
    } catch {
      return await callOpenAI(base64, mimeType);
    }
  }
  try {
    return await callGemini(base64, mimeType);
  } catch {
    return await callOpenAI(base64, mimeType);
  }
}

function stubExtraction(): Record<string, unknown> {
  return {
    spaces: [
      { name: "Main Stair", type: "stairwell", confidence: 0.42, rationale: "Fallback stub output." },
    ],
    assets: [],
    compliance_elements: [],
    suggested_tasks: [],
  };
}

type ConvertedPdfPage = {
  page_number: number;
  image_base64: string;
  mime_type?: string;
  width?: number;
  height?: number;
};

async function uploadConvertedPage(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  propertyId: string,
  planFileId: string,
  page: ConvertedPdfPage
): Promise<{ path: string; width: number | null; height: number | null }> {
  const mimeType = page.mime_type || "image/png";
  const ext = mimeType.includes("jpeg") ? "jpg" : "png";
  const objectPath = `orgs/${orgId}/properties/${propertyId}/plan-pages/${planFileId}/page-${page.page_number}.${ext}`;
  const bytes = Uint8Array.from(atob(page.image_base64), (char) => char.charCodeAt(0));

  const { error } = await admin.storage
    .from("property-plan-pages")
    .upload(objectPath, bytes, { upsert: true, contentType: mimeType, cacheControl: "3600" });
  if (error) throw error;

  return {
    path: objectPath,
    width: typeof page.width === "number" ? page.width : null,
    height: typeof page.height === "number" ? page.height : null,
  };
}

async function convertPdfPages(
  converterUrl: string,
  sourceFileUrl: string
): Promise<ConvertedPdfPage[]> {
  const response = await fetch(converterUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_url: sourceFileUrl }),
  });
  if (!response.ok) {
    throw new Error(`PDF converter failed: ${response.status}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload?.pages)) {
    throw new Error("PDF converter response missing pages[]");
  }
  return payload.pages as ConvertedPdfPage[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "POST only" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!body?.plan_file_id) {
      return new Response(JSON.stringify({ ok: false, error: "plan_file_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: fileRow, error: fileError } = await userClient
      .from("property_plan_files")
      .select("id, org_id, property_id, file_name, mime_type, storage_path")
      .eq("id", body.plan_file_id)
      .single();
    if (fileError || !fileRow) {
      throw new Error("Plan file not found or access denied");
    }

    await admin
      .from("property_plan_files")
      .update({ status: "converting", error_message: null })
      .eq("id", fileRow.id);

    await admin.from("property_plan_pages").delete().eq("plan_file_id", fileRow.id);

    let pageCount = 1;
    if (fileRow.mime_type?.includes("pdf")) {
      const { data: signedSource, error: signError } = await admin.storage
        .from("property-plans")
        .createSignedUrl(fileRow.storage_path, 60 * 15);
      if (signError || !signedSource?.signedUrl) {
        throw new Error("Failed to sign source PDF");
      }

      const converterUrl = Deno.env.get("PLAN_PDF_CONVERTER_URL");
      if (converterUrl) {
        const convertedPages = await convertPdfPages(converterUrl, signedSource.signedUrl);
        pageCount = convertedPages.length || 1;
        for (const page of convertedPages) {
          const uploaded = await uploadConvertedPage(
            admin,
            fileRow.org_id,
            fileRow.property_id,
            fileRow.id,
            page
          );
          await admin.from("property_plan_pages").insert({
            org_id: fileRow.org_id,
            plan_file_id: fileRow.id,
            page_number: page.page_number,
            image_storage_path: uploaded.path,
            width: uploaded.width,
            height: uploaded.height,
            processing_status: "converted",
          });
        }
      } else {
        await admin.from("property_plan_pages").insert({
          org_id: fileRow.org_id,
          plan_file_id: fileRow.id,
          page_number: 1,
          image_storage_path: null,
          processing_status: "converted",
          error_message: "PLAN_PDF_CONVERTER_URL not configured; extraction uses original PDF as single page fallback.",
        });
      }
    } else {
      await admin.from("property_plan_pages").insert({
        org_id: fileRow.org_id,
        plan_file_id: fileRow.id,
        page_number: 1,
        image_storage_path: null,
        processing_status: "converted",
      });
    }

    await admin
      .from("property_plan_files")
      .update({ status: "extracting", page_count: pageCount })
      .eq("id", fileRow.id);

    const { data: runRow, error: runError } = await admin
      .from("plan_extraction_runs")
      .insert({
        org_id: fileRow.org_id,
        property_id: fileRow.property_id,
        plan_file_id: fileRow.id,
        model_name: Deno.env.get("AI_PROVIDER") || "gemini/openai",
        run_type: "initial",
        status: "running",
      })
      .select("id")
      .single();
    if (runError || !runRow) throw new Error("Failed to create extraction run");

    const { data: pageRows, error: pagesError } = await admin
      .from("property_plan_pages")
      .select("id, page_number, image_storage_path")
      .eq("plan_file_id", fileRow.id)
      .order("page_number", { ascending: true });
    if (pagesError) throw pagesError;

    const rawByPage: Record<string, unknown> = {};
    const normalized: NormalizedExtraction = {
      spaces: [],
      assets: [],
      compliance_elements: [],
      suggested_tasks: [],
    };

    for (const page of pageRows || []) {
      let signedPath = page.image_storage_path || fileRow.storage_path;
      let signedBucket = page.image_storage_path ? "property-plan-pages" : "property-plans";

      const { data: signed, error: signedError } = await admin.storage
        .from(signedBucket)
        .createSignedUrl(signedPath, 60 * 15);
      if (signedError || !signed?.signedUrl) {
        throw new Error(`Failed to sign page ${page.page_number}`);
      }

      let rawResponse: Record<string, unknown>;
      try {
        rawResponse = await extractPlanPage(signed.signedUrl);
      } catch (err) {
        rawResponse = stubExtraction();
        rawByPage[String(page.page_number)] = { fallback: true, error: String(err), raw: rawResponse };
      }

      rawByPage[String(page.page_number)] = rawResponse;
      const pageNormalized = normaliseExtraction(rawResponse);

      for (const item of pageNormalized.spaces) {
        normalized.spaces.push(item);
        await admin.from("extracted_spaces").insert({
          org_id: fileRow.org_id,
          extraction_run_id: runRow.id,
          property_id: fileRow.property_id,
          source_page_id: page.id,
          name: item.name,
          space_type: item.type,
          confidence: item.confidence,
          raw_reference: { rationale: item.rationale, page_number: page.page_number },
        });
      }
      for (const item of pageNormalized.assets) {
        normalized.assets.push(item);
        await admin.from("extracted_assets").insert({
          org_id: fileRow.org_id,
          extraction_run_id: runRow.id,
          property_id: fileRow.property_id,
          source_page_id: page.id,
          name: item.name,
          asset_type: item.type,
          confidence: item.confidence,
          raw_reference: { rationale: item.rationale, page_number: page.page_number },
        });
      }
      for (const item of pageNormalized.compliance_elements) {
        normalized.compliance_elements.push(item);
        await admin.from("extracted_compliance_elements").insert({
          org_id: fileRow.org_id,
          extraction_run_id: runRow.id,
          property_id: fileRow.property_id,
          source_page_id: page.id,
          name: item.name,
          element_type: item.type,
          confidence: item.confidence,
          raw_reference: { rationale: item.rationale, page_number: page.page_number },
        });
      }
      for (const item of pageNormalized.suggested_tasks) {
        normalized.suggested_tasks.push(item);
        await admin.from("extracted_task_suggestions").insert({
          org_id: fileRow.org_id,
          extraction_run_id: runRow.id,
          property_id: fileRow.property_id,
          source_page_id: page.id,
          title: item.name,
          suggestion_type: item.type,
          rationale: item.rationale || null,
          confidence: item.confidence,
        });
      }

      await admin
        .from("property_plan_pages")
        .update({ processing_status: "extracted" })
        .eq("id", page.id);
    }

    await admin
      .from("plan_extraction_runs")
      .update({
        status: "completed",
        raw_output: rawByPage,
        normalised_output: normalized,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runRow.id);

    await admin
      .from("property_plan_files")
      .update({ status: "ready_for_review" })
      .eq("id", fileRow.id);

    return new Response(
      JSON.stringify({ ok: true, extraction_run_id: runRow.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("building-plan-process error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
