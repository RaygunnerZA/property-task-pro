import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  plan_file_id: string;
  building_label?: string | null;
  floor_label?: string | null;
  scale_known?: boolean | null;
  units?: string | null;
  setup_notes?: string | null;
  /** V1 default: spaces only. Assets/compliance/tasks are deferred. */
  extract_mode?: "spaces_only" | "full";
}

interface ExtractedSpace {
  name: string;
  type: string;
  confidence: number;
  rationale?: string;
  label_text?: string;
  review_band: "reliable" | "needs_confirmation" | "incomplete";
}

interface NormalizedExtraction {
  spaces: ExtractedSpace[];
  assets: never[];
  compliance_elements: never[];
  suggested_tasks: never[];
}

function buildSpacesPrompt(ctx: {
  building_label?: string | null;
  floor_label?: string | null;
  setup_notes?: string | null;
}): string {
  const building = ctx.building_label?.trim() || "unspecified building";
  const floor = ctx.floor_label?.trim() || "unspecified floor";
  const notes = ctx.setup_notes?.trim();
  return `You help a property operator set up Spaces from a floor plan sheet.
This sheet is for building "${building}", floor/level "${floor}".
${notes ? `Operator notes: ${notes}\n` : ""}
Return JSON only with shape:
{
  "spaces":[{
    "name":"",
    "type":"",
    "confidence":0.0,
    "rationale":"",
    "label_text":""
  }]
}

Rules:
- Extract room / space labels visible on the plan (or clearly labelled areas).
- Prefer the printed label for "name" and "label_text".
- Do NOT invent rooms that are not labelled or strongly implied by walls + labels.
- Do NOT extract assets, fixtures, fire equipment, or suggest tasks.
- Prefer omit over hallucinating.
- Confidence must be between 0 and 1.
- Types: snake_case (e.g. office, meeting_room, corridor, stairwell, plant_room, wc, kitchen, store, lobby, unknown).
- If a label is unclear, still return it with low confidence and say why in rationale.`;
}

function clampConfidence(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function reviewBandFor(confidence: number, name: string, type: string): ExtractedSpace["review_band"] {
  if (!name.trim() || type === "unknown" || confidence < 0.5) return "incomplete";
  if (confidence >= 0.75) return "reliable";
  return "needs_confirmation";
}

function normalizeSpaces(input: unknown): ExtractedSpace[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const row = (item || {}) as Record<string, unknown>;
      const name = String(row.name || row.label_text || "").trim();
      const type = String(row.type || "unknown").trim() || "unknown";
      if (!name) return null;
      const confidence = clampConfidence(row.confidence);
      return {
        name,
        type,
        confidence,
        rationale: typeof row.rationale === "string" ? row.rationale : undefined,
        label_text: typeof row.label_text === "string" ? row.label_text : name,
        review_band: reviewBandFor(confidence, name, type),
      };
    })
    .filter(Boolean) as ExtractedSpace[];
}

function normaliseExtraction(rawResponse: Record<string, unknown>): NormalizedExtraction {
  return {
    spaces: normalizeSpaces(rawResponse.spaces),
    assets: [],
    compliance_elements: [],
    suggested_tasks: [],
  };
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

async function callGemini(
  prompt: string,
  base64: string,
  mimeType: string
): Promise<Record<string, unknown>> {
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
              { text: prompt },
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

async function callOpenAI(
  prompt: string,
  base64: string,
  mimeType: string
): Promise<Record<string, unknown>> {
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
            { type: "text", text: prompt },
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

async function extractPlanPage(
  prompt: string,
  pageImageUrl: string
): Promise<Record<string, unknown>> {
  const { base64, mimeType } = await fetchAsBase64(pageImageUrl);
  const provider = (Deno.env.get("AI_PROVIDER") || "gemini").toLowerCase();
  if (provider === "openai") {
    try {
      return await callOpenAI(prompt, base64, mimeType);
    } catch {
      return await callGemini(prompt, base64, mimeType);
    }
  }
  if (provider === "gemini") {
    try {
      return await callGemini(prompt, base64, mimeType);
    } catch {
      return await callOpenAI(prompt, base64, mimeType);
    }
  }
  try {
    return await callGemini(prompt, base64, mimeType);
  } catch {
    return await callOpenAI(prompt, base64, mimeType);
  }
}

function stubExtraction(): Record<string, unknown> {
  return {
    spaces: [
      {
        name: "Unlabelled area",
        type: "unknown",
        confidence: 0.35,
        rationale: "Fallback stub — review and rename before creating.",
        label_text: "",
      },
    ],
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

  let trackedPlanFileId: string | null = null;

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
    trackedPlanFileId = body.plan_file_id;

    const extractMode = body.extract_mode === "full" ? "full" : "spaces_only";
    const buildingLabel =
      typeof body.building_label === "string" ? body.building_label.trim() || null : null;
    const floorLabel =
      typeof body.floor_label === "string" ? body.floor_label.trim() || null : null;
    const setupNotes =
      typeof body.setup_notes === "string" ? body.setup_notes.trim() || null : null;
    const units = typeof body.units === "string" ? body.units.trim() || null : null;
    const scaleKnown =
      typeof body.scale_known === "boolean" ? body.scale_known : null;

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
      .select(
        "id, org_id, property_id, file_name, mime_type, storage_path, building_label, floor_label, setup_notes, units, scale_known"
      )
      .eq("id", body.plan_file_id)
      .single();
    if (fileError || !fileRow) {
      throw new Error("Plan file not found or access denied");
    }

    const resolvedBuilding = buildingLabel ?? fileRow.building_label ?? null;
    const resolvedFloor = floorLabel ?? fileRow.floor_label ?? null;
    const resolvedNotes = setupNotes ?? fileRow.setup_notes ?? null;
    const resolvedUnits = units ?? fileRow.units ?? null;
    const resolvedScale =
      scaleKnown !== null ? scaleKnown : fileRow.scale_known ?? null;

    const extractionPrompt = buildSpacesPrompt({
      building_label: resolvedBuilding,
      floor_label: resolvedFloor,
      setup_notes: resolvedNotes,
    });

    await admin
      .from("property_plan_files")
      .update({
        status: "converting",
        error_message: null,
        building_label: resolvedBuilding,
        floor_label: resolvedFloor,
        setup_notes: resolvedNotes,
        units: resolvedUnits,
        scale_known: resolvedScale,
      })
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
      const signedPath = page.image_storage_path || fileRow.storage_path;
      const signedBucket = page.image_storage_path ? "property-plan-pages" : "property-plans";

      const { data: signed, error: signedError } = await admin.storage
        .from(signedBucket)
        .createSignedUrl(signedPath, 60 * 15);
      if (signedError || !signed?.signedUrl) {
        throw new Error(`Failed to sign page ${page.page_number}`);
      }

      let rawResponse: Record<string, unknown>;
      try {
        rawResponse = await extractPlanPage(extractionPrompt, signed.signedUrl);
      } catch (err) {
        rawResponse = stubExtraction();
        rawByPage[String(page.page_number)] = {
          fallback: true,
          error: String(err),
          raw: rawResponse,
        };
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
          floor_label: resolvedFloor,
          review_band: item.review_band,
          is_accepted: false,
          raw_reference: {
            rationale: item.rationale,
            label_text: item.label_text,
            page_number: page.page_number,
            building_label: resolvedBuilding,
            floor_label: resolvedFloor,
            extract_mode: extractMode,
          },
        });
      }

      // V1 spaces_only: skip assets / compliance / tasks even if the model returns them.
      if (extractMode === "full") {
        // Reserved for a later assistant step — intentionally not implemented in V1.
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
      JSON.stringify({
        ok: true,
        extraction_run_id: runRow.id,
        extract_mode: extractMode,
        space_count: normalized.spaces.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("building-plan-process error:", error);
    if (trackedPlanFileId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && serviceRoleKey) {
          const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          await admin
            .from("property_plan_files")
            .update({ status: "failed", error_message: String(error) })
            .eq("id", trackedPlanFileId);
        }
      } catch {
        // ignore secondary failure
      }
    }
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
