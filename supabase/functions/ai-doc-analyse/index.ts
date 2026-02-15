// ai-doc-analyse — Phase 5: Full document intelligence for property documents
// Uses Gemini/OpenAI Vision for OCR, expiry extraction, compliance category, space/asset inference
// Does NOT auto-link — stores suggestions in metadata only

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  file_url: string;
  file_name: string;
  property_id?: string | null;
  org_id: string;
  attachment_id?: string | null; // if provided, we update the attachment
  overwrite?: boolean;
}

interface DetectedAsset {
  asset_id?: string;
  serial_number?: string;
  model?: string;
  name?: string;
  confidence: number;
}

interface ResponseBody {
  title: string | null;
  document_type: string | null;
  category: string | null;
  expiry_date: string | null;
  renewal_frequency: string | null;
  confidence: number;
  ocr_text: string | null;
  detected_spaces: string[];
  detected_assets: DetectedAsset[];
  compliance_recommendations: string[];
  hazards: string[];
  suggested_icon?: string | null;
  metadata: Record<string, unknown>;
}

const DOC_ANALYSIS_PROMPT = `Analyze this property document (PDF or image). Extract metadata for facilities/property management.

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:

{
  "title": "Document title inferred from content or filename",
  "document_type": "EICR | Gas Safety Certificate | Fire Risk Assessment | Fire Certificate | PAT Test | Legionella Risk Assessment | EIC | Asbestos Register | O&M Manual | Insurance Certificate | Lease | Plan | Other",
  "category": "Electrical | Fire Safety | Mechanical | Water | Legal | Plans | Insurance | O&M Manuals | Misc",
  "expiry_date": "YYYY-MM-DD or null if not found",
  "renewal_frequency": "annual | 5-year | 6mo | 1yr | 2yr | 5yr | null",
  "confidence": 0.0 to 1.0,
  "ocr_text": "All readable text from the document (first 2000 chars)",
  "detected_spaces": ["Boiler Room", "Kitchen", "Plant Room", "Warehouse", "Office", "etc - space names found in document"],
  "detected_assets": [
    {
      "serial_number": "extracted serial if found",
      "model": "model number if found",
      "name": "asset name if inferred",
      "confidence": 0.0 to 1.0
    }
  ],
  "compliance_recommendations": ["Link to Fire Documentation", "Link to EICR record", etc - suggestions based on document type],
  "hazards": ["fire", "electrical", "slip", "water", "structural", "obstruction", "hygiene", "ventilation", "unknown" - use if applicable, else generic keywords],
  "metadata": {}
}

Focus on: certificates, expiry dates, space references, serial/model numbers, safety warnings. Use snake_case for hazards. Preferred hazard categories: fire, electrical, slip, water, structural, obstruction, hygiene, ventilation, unknown.`;

function getGeminiKey(): string | undefined {
  return Deno.env.get("GEMINI_API_KEY");
}

function getOpenAIApiKey(): string | undefined {
  return Deno.env.get("OPENAI_API_KEY");
}

async function fetchFileAsBase64(fileUrl: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
  const blob = await res.blob();
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const mimeType = blob.type || "application/octet-stream";
  return { base64, mimeType };
}

function getMimeForFile(fileName: string): string {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  return "image/jpeg"; // fallback
}

async function callGeminiDoc(
  fileBase64: string,
  mimeType: string,
  fileName: string
): Promise<ResponseBody> {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const parts: unknown[] = [
    { text: DOC_ANALYSIS_PROMPT },
    {
      inline_data: {
        mime_type: mimeType,
        data: fileBase64,
      },
    },
  ];

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} - ${err}`);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");

  return normalizeDocResponse(JSON.parse(text), fileName);
}

async function callOpenAIDoc(
  fileBase64: string,
  mimeType: string,
  fileName: string
): Promise<ResponseBody> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const dataUrl = `data:${mimeType};base64,${fileBase64}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: DOC_ANALYSIS_PROMPT },
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} - ${err}`);
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty OpenAI response");

  return normalizeDocResponse(JSON.parse(text), fileName);
}

function normalizeDocResponse(parsed: Record<string, unknown>, fileName: string): ResponseBody {
  const title = (parsed.title as string) || fileName.replace(/\.[^/.]+$/, "") || "Untitled";
  const document_type = (parsed.document_type as string) || null;
  const category = (parsed.category as string) || null;
  const expiry_date = (parsed.expiry_date as string) || null;
  const renewal_frequency = (parsed.renewal_frequency as string) || null;
  const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;
  const ocr_text = (parsed.ocr_text as string) || null;
  const detected_spaces = Array.isArray(parsed.detected_spaces) ? parsed.detected_spaces : [];
  const detected_assets = Array.isArray(parsed.detected_assets)
    ? (parsed.detected_assets as DetectedAsset[])
    : [];
  const compliance_recommendations = Array.isArray(parsed.compliance_recommendations)
    ? parsed.compliance_recommendations
    : [];
  const hazards = Array.isArray(parsed.hazards) ? parsed.hazards : [];
  const metadata = (parsed.metadata as Record<string, unknown>) || {};

  return {
    title,
    document_type,
    category,
    expiry_date,
    renewal_frequency,
    confidence,
    ocr_text,
    detected_spaces,
    detected_assets,
    compliance_recommendations,
    hazards,
    suggested_icon: (metadata.suggested_icon as string) || null,
    metadata: { ...metadata, raw: parsed },
  };
}

function computeExpiryStatus(expiryDate: string | null | undefined): string | null {
  if (!expiryDate) return null;
  const exp = new Date(expiryDate);
  const now = new Date();
  const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return "red";
  if (daysLeft < 60) return "amber";
  return "green";
}

function stubResponse(fileName: string): ResponseBody {
  const title = fileName.replace(/\.[^/.]+$/, "") || "Untitled";
  const category = inferCategoryFromFilename(fileName);
  const document_type = inferDocTypeFromFilename(fileName);
  return {
    title,
    document_type,
    category,
    expiry_date: null,
    renewal_frequency: null,
    confidence: 0.3,
    ocr_text: null,
    detected_spaces: [],
    detected_assets: [],
    compliance_recommendations: [],
    hazards: [],
    suggested_icon: null,
    metadata: { stub: true },
  };
}

function inferCategoryFromFilename(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  if (lower.includes("plan") || lower.includes("drawing")) return "Plans";
  if (lower.includes("lease") || lower.includes("contract") || lower.includes("legal")) return "Legal";
  if (lower.includes("fire") || lower.includes("safety")) return "Fire Safety";
  if (lower.includes("electrical") || lower.includes("eic")) return "Electrical";
  if (lower.includes("gas") || lower.includes("hvac")) return "Mechanical";
  if (lower.includes("water") || lower.includes("plumb") || lower.includes("legionella")) return "Water";
  if (lower.includes("insurance")) return "Insurance";
  if (lower.includes("warrant")) return "Warranties";
  if (lower.includes("om ") || lower.includes("o&m") || lower.includes("manual")) return "O&M Manuals";
  return "Misc";
}

function inferDocTypeFromFilename(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  if (lower.includes("eicr") || lower.includes("electrical")) return "EICR";
  if (lower.includes("gas")) return "Gas Safety Certificate";
  if (lower.includes("fire") && lower.includes("risk")) return "Fire Risk Assessment";
  if (lower.includes("fire")) return "Fire Certificate";
  if (lower.includes("pat")) return "PAT Test";
  if (lower.includes("legionella")) return "Legionella Risk Assessment";
  if (lower.includes("asbestos")) return "Asbestos Register";
  return null;
}

const HAZARD_TO_ACTION: Record<string, { risk: "low" | "medium" | "high" | "critical"; action: string }> = {
  fire: { risk: "high", action: "Fire Extinguisher Service" },
  electrical: { risk: "high", action: "Schedule EICR" },
  slip: { risk: "medium", action: "Review slip/trip hazards" },
  water: { risk: "medium", action: "Review Legionella Report" },
  structural: { risk: "critical", action: "Immediate assessment recommended" },
  obstruction: { risk: "medium", action: "Clear obstruction and reassess" },
  hygiene: { risk: "medium", action: "Hygiene inspection recommended" },
  ventilation: { risk: "medium", action: "Ventilation assessment" },
  unknown: { risk: "low", action: "Further investigation recommended" },
};

const DOC_TYPE_TO_ACTION: Record<string, string> = {
  EICR: "Book EICR test with contractor",
  "Gas Safety Certificate": "Renew Gas Safety Certificate",
  "Fire Risk Assessment": "Schedule Fire Risk Assessment",
  "Fire Certificate": "Renew Fire Certificate",
  "PAT Test": "Schedule PAT testing",
  "Legionella Risk Assessment": "Review Legionella Report",
  "Asbestos Register": "Review Asbestos Register",
};

function buildInterpretation(
  result: ResponseBody,
  complianceDocumentId: string,
  propertyId: string | null | undefined,
  orgId: string
): { interpretation: boolean; rec: Record<string, unknown> } {
  const hazards = Array.isArray(result.hazards) ? result.hazards : [];
  const expiryDate = result.expiry_date ? new Date(result.expiry_date) : null;
  const now = new Date();
  const daysLeft = expiryDate ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

  let riskLevel: "low" | "medium" | "high" | "critical" = "low";
  let recommendedAction = "Review document status";

  if (hazards.length > 0) {
    const hazardMap = hazards.map((h) => {
      const key = h.toLowerCase().replace(/\s/g, "_");
      return HAZARD_TO_ACTION[key] || HAZARD_TO_ACTION[h] || HAZARD_TO_ACTION.unknown;
    });
    const critical = hazardMap.find((x) => x?.risk === "critical");
    const high = hazardMap.find((x) => x?.risk === "high");
    if (critical) {
      riskLevel = "critical";
      recommendedAction = critical.action;
    } else if (high) {
      riskLevel = "high";
      recommendedAction = high.action;
    } else if (hazardMap[0]) {
      riskLevel = hazardMap[0].risk as "low" | "medium" | "high" | "critical";
      recommendedAction = hazardMap[0].action;
    }
  }

  if (daysLeft !== null) {
    if (daysLeft < 0) {
      if (riskLevel === "low") riskLevel = "medium";
      if (riskLevel === "medium") riskLevel = "high";
    } else if (daysLeft <= 30) {
      if (riskLevel === "low") riskLevel = "medium";
    }
  }

  const docType = result.document_type;
  if (docType && DOC_TYPE_TO_ACTION[docType]) {
    recommendedAction = DOC_TYPE_TO_ACTION[docType];
  }

  const suggestedTasks = [
    {
      title: recommendedAction,
      description: `${result.title || "Compliance item"} - ${docType || "Document"}`,
      dueDate: result.expiry_date || undefined,
      propertyId: propertyId || undefined,
    },
  ];

  return {
    interpretation: true,
    rec: {
      org_id: orgId,
      compliance_document_id: complianceDocumentId,
      property_id: propertyId || null,
      asset_ids: [],
      space_ids: [],
      risk_level: riskLevel,
      recommended_action: recommendedAction,
      recommended_tasks: suggestedTasks,
      hazards: hazards.length > 0 ? hazards : [],
      status: "pending",
    },
  };
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

    const { file_url, file_name, property_id, org_id, attachment_id, overwrite = false } = body;

    if (!file_url || !file_name || !org_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields: file_url, file_name, org_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: ResponseBody;

    try {
      const { base64, mimeType } = await fetchFileAsBase64(file_url);
      const effectiveMime = mimeType !== "application/octet-stream" ? mimeType : getMimeForFile(file_name);

      if (getGeminiKey()) {
        result = await callGeminiDoc(base64, effectiveMime, file_name);
      } else if (getOpenAIApiKey()) {
        if (effectiveMime === "application/pdf") {
          result = stubResponse(file_name);
        } else {
          result = await callOpenAIDoc(base64, effectiveMime, file_name);
        }
      } else {
        result = stubResponse(file_name);
      }
    } catch (err) {
      console.error("ai-doc-analyse error:", err);
      result = stubResponse(file_name);
    }

    const status = computeExpiryStatus(result.expiry_date);

    if (attachment_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (serviceRoleKey) {
        const admin = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const updatePayload: Record<string, unknown> = {
          title: result.title,
          document_type: result.document_type,
          category: result.category,
          expiry_date: result.expiry_date,
          renewal_frequency: result.renewal_frequency,
          status,
          ocr_text: result.ocr_text,
          ai_confidence: result.confidence,
          metadata: {
            detected_spaces: result.detected_spaces,
            detected_assets: result.detected_assets,
            compliance_recommendations: result.compliance_recommendations,
            hazards: result.hazards,
            analysed_at: new Date().toISOString(),
            ...result.metadata,
          },
          updated_at: new Date().toISOString(),
        };

        await admin
          .from("attachments")
          .update(updatePayload)
          .eq("id", attachment_id)
          .eq("org_id", org_id);

        if (result.expiry_date) {
          const { data: links } = await admin
            .from("attachment_compliance")
            .select("compliance_document_id")
            .eq("attachment_id", attachment_id)
            .eq("org_id", org_id);
          const complianceIds = (links || []).map((r: { compliance_document_id: string }) => r.compliance_document_id);
          if (complianceIds.length === 1) {
            const status = result.expiry_date
              ? (() => {
                  const exp = new Date(result.expiry_date);
                  const now = new Date();
                  const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  return days < 0 ? "red" : days < 60 ? "amber" : "green";
                })()
              : "unknown";
            await admin
              .from("compliance_documents")
              .update({
                next_due_date: result.expiry_date,
                expiry_date: result.expiry_date,
                status,
                hazards: result.hazards?.length ? result.hazards : [],
                updated_at: new Date().toISOString(),
              })
              .eq("id", complianceIds[0])
              .eq("org_id", org_id);
            await admin.from("compliance_history").insert({
              compliance_document_id: complianceIds[0],
              event: "expiry-updated",
              data: { source: "ai-doc-analyse", expiry_date: result.expiry_date, attachment_id },
              org_id,
            });

            // Phase 9: Write compliance_recommendations (interpretation layer)
            const { interpretation, rec } = buildInterpretation(
              result,
              complianceIds[0],
              property_id,
              org_id
            );
            if (interpretation) {
              const { data: existing } = await admin
                .from("compliance_recommendations")
                .select("id")
                .eq("compliance_document_id", complianceIds[0])
                .eq("org_id", org_id)
                .maybeSingle();
              if (!existing || overwrite) {
                if (existing) {
                  await admin
                    .from("compliance_recommendations")
                    .update({
                      risk_level: rec.risk_level,
                      recommended_action: rec.recommended_action,
                      recommended_tasks: rec.recommended_tasks || [],
                      hazards: rec.hazards || [],
                      property_id: rec.property_id || null,
                      updated_at: new Date().toISOString(),
                      status: overwrite ? "pending" : undefined,
                    })
                    .eq("id", existing.id)
                    .eq("org_id", org_id);
                } else {
                  await admin.from("compliance_recommendations").insert(rec);
                }
              }
            }
          }
        }
      }
    }

    // Phase 12B: Icon suggestion from document type (do not auto-apply)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (result.document_type && serviceRoleKey) {
      try {
        const admin = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const searchTerms = `${result.document_type} ${result.category || ""} certificate document`.trim();
        const { data: icons } = await admin.rpc("ai_icon_search", { query_text: searchTerms });
        if (icons && Array.isArray(icons) && icons.length > 0) {
          const first = icons[0] as { name?: string };
          result.suggested_icon = first.name ?? null;
          result.metadata = { ...result.metadata, suggested_icon: result.suggested_icon };
        }
      } catch {
        // Non-fatal; icon suggestion is optional
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-doc-analyse error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
