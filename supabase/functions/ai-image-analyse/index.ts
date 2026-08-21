// ai-image-analyse — OCR + object detection for task images
// Phase 1: Accepts base64 image (pre-upload) — returns JSON only, no DB writes
// Phase 2: Accepts file_url + attachment_id (post-upload), stores results, links assets
// Phase 3: Idempotency guard — if analysis exists for attachment_id and overwrite=false, skip

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geminiUsage, openAiUsage } from "../_shared/aiObservability.ts";
import { runCapability, type ExecutorOutput } from "../_shared/aiCall.ts";
import { SchemaError, parseJsonLoose } from "../_shared/aiRouting.ts";
import {
  assertAiOpsAllowed,
  aiAllowanceExhaustedResponse,
} from "../_shared/aiEntitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  image?: string; // base64 (Phase 1)
  file_url?: string; // Phase 2 post-upload
  attachment_id?: string;
  org_id: string;
  property_id?: string | null;
  task_id?: string;
  mode?: "router" | "full"; // router: fast first-pass hints only
  overwrite?: boolean; // Phase 3: if true, re-run analysis even when result exists
}

interface DetectedObject {
  type: string;
  label: string;
  confidence: number;
  serial_number?: string;
  expiry_date?: string;
  model?: string;
}

/** Guard a model payload before it is trusted as a shape. */
function expectJsonObject(raw: unknown, label: string): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SchemaError(`${label} response was not a JSON object`);
  }
  return raw as Record<string, unknown>;
}

interface DocumentClassification {
  type?: string;
  expiry_date?: string;
}

interface ResponseBody {
  ocr_text: string;
  detected_labels: string[];
  detected_objects: DetectedObject[];
  document_classification?: DocumentClassification;
  anomalies: unknown[];
  suggested_icon?: string | null;
  metadata: Record<string, unknown>;
}

const ANALYSIS_PROMPT = `Analyze this property/maintenance image. Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:

{
  "ocr_text": "All readable text from the image (labels, signs, plates, serial numbers, table cells)",
  "detected_labels": ["fire extinguisher", "serial 8844", "expiry 2027", ...],
  "detected_objects": [
    {
      "type": "fire_extinguisher",
      "label": "Fire Extinguisher",
      "confidence": 0.92,
      "serial_number": "8844",
      "expiry_date": "2027-01-01",
      "model": "AB33"
    }
  ],
  "document_classification": {
    "type": "Fire Certificate",
    "expiry_date": "2025-04-01"
  },
  "anomalies": [],
  "metadata": {}
}

Rules:
- Read the whole page, including headers and tables.
- If this is a certificate, inspection, or service record, set document_classification.type to the document's own title (never "None" or "Unknown").
- document_classification.expiry_date must be the next due / next test / next inspection / valid until / expiry date, as YYYY-MM-DD. Convert UK dates such as 01/03/26 to 2026-03-01.
- If several dates appear, use the next-due date, not the date of service or print date.
- Never invent a date that is not printed.
- For equipment photos (not documents), still extract serials and any expiry printed on labels.
- Use snake_case for detected object type.`;

const ROUTER_PROMPT = `You are a fast intake router for a property management app.
Return ONLY valid JSON (no markdown) with this exact structure:
{
  "workflow_hint": "task|compliance|document|uncertain",
  "workflow_confidence": 0.0,
  "document_type_hint": "string|null",
  "expiry_date_hint": "YYYY-MM-DD|null",
  "task_title_hint": "string|null",
  "labels": ["string"]
}
Rules:
- Keep it shallow and fast; do not perform deep extraction.
- workflow_hint must be one of task, compliance, document, uncertain.
- workflow_confidence is 0..1.
- labels must be short, max 6.
- A photo of equipment alone (boiler, appliance, pipe, HVAC, pump, extinguisher, electrical board) is NOT a compliance record. Classify as task if there is visible damage, leak, staining, corrosion, loose fittings, or fault evidence; otherwise uncertain (not compliance).
- Classify as compliance only when the image is clearly a document, certificate, inspection record, or label/plate with readable expiry or certificate wording.
- Visible damage, leak, staining, broken parts, corrosion, or fault evidence → workflow_hint task.
- Prefer uncertain over compliance when the image is equipment without readable certificate/document text.
- document_type_hint must be null unless a real certificate/document type is visible (never use "None" or "Unknown" as a type string).
- expiry_date_hint is the next due / next test / valid until / expiry date as YYYY-MM-DD, or null. Convert UK dates (01/03/26 → 2026-03-01). Never invent a date.
- If unsure, use uncertain with low confidence.`;

const MEANINGLESS_DOC_TYPES = new Set([
  "none",
  "unknown",
  "n/a",
  "na",
  "null",
  "undefined",
  "not_applicable",
  "not applicable",
]);

function sanitizeDocumentType(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (MEANINGLESS_DOC_TYPES.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

function getGeminiKey(): string | undefined {
  return Deno.env.get("GEMINI_API_KEY");
}

function getOpenAIApiKey(): string | undefined {
  return Deno.env.get("OPENAI_API_KEY");
}

async function callGeminiVision(imageBase64: string): Promise<ExecutorOutput> {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: ANALYSIS_PROMPT },
            {
              inline_data: {
                mime_type: "image/webp",
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} - ${err}`);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new SchemaError("Empty Gemini response");

  return { raw: parseJsonLoose(text), usage: geminiUsage(json) };
}

async function callGeminiVisionRouter(imageBase64: string): Promise<ExecutorOutput> {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: ROUTER_PROMPT },
            {
              inline_data: {
                mime_type: "image/webp",
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 220,
        temperature: 0,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini router API error: ${res.status} - ${err}`);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new SchemaError("Empty Gemini router response");

  return { raw: parseJsonLoose(text), usage: geminiUsage(json) };
}

async function callOpenAIVision(imageBase64: string): Promise<ExecutorOutput> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

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
            { type: "text", text: ANALYSIS_PROMPT },
            {
              type: "image_url",
              image_url: { url: `data:image/webp;base64,${imageBase64}` },
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
  if (!text) throw new SchemaError("Empty OpenAI response");

  return { raw: parseJsonLoose(text), usage: openAiUsage(json) };
}

async function callOpenAIVisionRouter(imageBase64: string): Promise<ExecutorOutput> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

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
            { type: "text", text: ROUTER_PROMPT },
            {
              type: "image_url",
              image_url: { url: `data:image/webp;base64,${imageBase64}` },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 220,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI router API error: ${res.status} - ${err}`);
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new SchemaError("Empty OpenAI router response");

  return { raw: parseJsonLoose(text), usage: openAiUsage(json) };
}

// Phase 4: Map freeform document types to normalized values
const DOC_TYPE_MAP: Record<string, string> = {
  fire_certificate: "Fire Certificate",
  fire_extinguisher: "Fire Extinguisher Certificate",
  pat_test: "PAT Test",
  gas_safety: "Gas Safety Certificate",
  electrical: "Electrical Certificate",
  eic: "Electrical Installation Certificate",
  fga: "Fire Gas Alarm",
  eicr: "EICR",
};

// Phase 4: Map detected object types to asset categories
const ASSET_TYPE_MAP: Record<string, string> = {
  fire_extinguisher: "Fire Safety",
  boiler: "Boiler",
  pump: "Plumbing",
  hvac: "HVAC",
  db_board: "Electrical",
  appliance: "Appliance",
};

// Phase 12B: Hazard/detected object → Lucide icon mapping
const HAZARD_OBJECT_TO_ICON: Record<string, string> = {
  corrosion: "alert-triangle",
  "water leak": "droplet",
  "water_leak": "droplet",
  leak: "droplet",
  electrical: "zap",
  "electrical panel": "zap",
  "electrical_panel": "zap",
  "fire extinguisher": "fire-extinguisher",
  fire_extinguisher: "fire-extinguisher",
  extinguisher: "fire-extinguisher",
  fire: "flame",
  boiler: "flame",
  pump: "droplet",
  hvac: "fan",
  db_board: "zap",
  hazard: "alert-triangle",
  warning: "alert-triangle",
  slip: "alert-triangle",
  structural: "alert-triangle",
  obstruction: "alert-triangle",
};

function normalizeResponse(raw: unknown): ResponseBody {
  const parsed = expectJsonObject(raw, "Image analysis") as Partial<ResponseBody>;
  const docClass = parsed.document_classification;
  const docTypeRaw = docClass?.type?.toLowerCase().replace(/\s+/g, "_") ?? "";
  const mappedType = DOC_TYPE_MAP[docTypeRaw] ?? docClass?.type ?? null;
  const normalizedDocType = sanitizeDocumentType(mappedType);
  const normalizedExpiry = docClass?.expiry_date ?? null;
  const rawOcr = parsed.ocr_text ?? "";

  const detectedObjects = Array.isArray(parsed.detected_objects) ? parsed.detected_objects : [];
  const confidenceMap: Record<string, number> = {};
  detectedObjects.forEach((o, i) => {
    confidenceMap[`object_${i}`] = o.confidence ?? 0;
  });
  if (docClass?.type) confidenceMap.document_type = 0.85;
  if (docClass?.expiry_date) confidenceMap.expiry = 0.9;

  const firstObj = detectedObjects[0];
  const normalizedAssetType = firstObj
    ? (ASSET_TYPE_MAP[firstObj.type] ?? firstObj.label ?? null)
    : null;

  // Phase 12B: Suggest icon from detected objects + anomalies
  let suggestedIcon: string | null = null;
  const terms = [
    ...detectedObjects.map((o) => (o.type || o.label || "").toLowerCase().replace(/\s+/g, "_")),
    ...(Array.isArray(parsed.anomalies) ? parsed.anomalies.map((a: unknown) => String(a).toLowerCase()) : []),
  ];
  for (const term of terms) {
    const icon = HAZARD_OBJECT_TO_ICON[term] || HAZARD_OBJECT_TO_ICON[term.replace(/_/g, " ")];
    if (icon) {
      suggestedIcon = icon;
      break;
    }
  }
  if (!suggestedIcon && detectedObjects[0]) {
    suggestedIcon = HAZARD_OBJECT_TO_ICON[detectedObjects[0].type] ?? HAZARD_OBJECT_TO_ICON[detectedObjects[0].label?.toLowerCase()] ?? "alert-triangle";
  }

  const metadata: Record<string, unknown> = {
    ...(parsed.metadata ?? {}),
    normalized_document_type: normalizedDocType,
    normalized_asset_type: normalizedAssetType,
    normalized_expiry: normalizedExpiry,
    document_classification: docClass ?? (parsed.metadata as Record<string, unknown> | undefined)?.document_classification,
    confidence_map: confidenceMap,
    raw_ocr: rawOcr,
    suggested_icon: suggestedIcon,
  };

  return {
    ocr_text: rawOcr,
    detected_labels: Array.isArray(parsed.detected_labels) ? parsed.detected_labels : [],
    detected_objects: detectedObjects,
    document_classification: docClass,
    anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : [],
    suggested_icon: suggestedIcon,
    metadata,
  };
}

function normalizeRouterResponse(raw: unknown): ResponseBody {
  const parsed = expectJsonObject(raw, "Image router");
  const workflowHintRaw = String(parsed.workflow_hint ?? "uncertain").toLowerCase();
  const workflowHint =
    workflowHintRaw === "task" ||
    workflowHintRaw === "compliance" ||
    workflowHintRaw === "document" ||
    workflowHintRaw === "uncertain"
      ? workflowHintRaw
      : "uncertain";

  const confidenceNum = Number(parsed.workflow_confidence ?? 0.35);
  const workflowConfidence = Number.isFinite(confidenceNum)
    ? Math.max(0, Math.min(1, confidenceNum))
    : 0.35;

  const documentType = sanitizeDocumentType(
    typeof parsed.document_type_hint === "string" ? parsed.document_type_hint : null
  );
  const expiryDate =
    typeof parsed.expiry_date_hint === "string" && parsed.expiry_date_hint.trim()
      ? parsed.expiry_date_hint.trim()
      : null;
  const taskTitleHint =
    typeof parsed.task_title_hint === "string" && parsed.task_title_hint.trim()
      ? parsed.task_title_hint.trim()
      : null;
  const labels = Array.isArray(parsed.labels)
    ? parsed.labels.map((v) => String(v)).filter(Boolean).slice(0, 6)
    : [];

  const metadata: Record<string, unknown> = {
    router_mode: true,
    workflow_hint: workflowHint,
    workflow_confidence: workflowConfidence,
    task_title_hint: taskTitleHint,
    normalized_document_type: documentType,
    normalized_expiry: expiryDate,
    document_classification: documentType
      ? {
          type: documentType,
          expiry_date: expiryDate,
        }
      : undefined,
  };

  return {
    ocr_text: "",
    detected_labels: labels,
    detected_objects: [],
    document_classification: documentType
      ? {
          type: documentType,
          expiry_date: expiryDate ?? undefined,
        }
      : undefined,
    anomalies: [],
    suggested_icon: null,
    metadata,
  };
}

function stubResponse(): ResponseBody {
  return {
    ocr_text: "",
    detected_labels: [],
    detected_objects: [],
    anomalies: [],
    suggested_icon: null,
    metadata: { stub: true },
  };
}

async function fetchImageAsBase64(fileUrl: string): Promise<string> {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const blob = await res.blob();
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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

    const { image, file_url, attachment_id, org_id, property_id, mode = "full", overwrite = false } = body;

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: org_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    {
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (serviceRoleKey) {
        const gateClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const gate = await assertAiOpsAllowed(gateClient, org_id, "ai-image-analyse");
        if (!gate.allowed) {
          return aiAllowanceExhaustedResponse(gate, corsHeaders, {
            skipped: true,
            ocr_text: "",
            detected_labels: [],
            detected_objects: [],
            anomalies: [],
            metadata: { ai_allowance_exhausted: true },
          });
        }
      }
    }

    // Phase 3: Idempotency guard - skip if analysis already exists and overwrite is false
    if (attachment_id && !overwrite) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (serviceRoleKey) {
        const admin = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data: existing } = await admin
          .from("image_analysis_results")
          .select("id, ocr_text, detected_objects, raw_response, metadata")
          .eq("attachment_id", attachment_id)
          .limit(1)
          .maybeSingle();

        if (existing) {
          const raw = existing.raw_response as ResponseBody | null;
          const result: ResponseBody = raw
            ? {
                ocr_text: raw.ocr_text ?? existing.ocr_text ?? "",
                detected_labels: raw.detected_labels ?? [],
                detected_objects: Array.isArray(raw.detected_objects) ? raw.detected_objects : [],
                document_classification: raw.document_classification,
                anomalies: raw.anomalies ?? [],
                metadata: raw.metadata ?? {},
              }
            : {
                ocr_text: existing.ocr_text ?? "",
                detected_labels: [],
                detected_objects: (existing.detected_objects as DetectedObject[]) ?? [],
                anomalies: [],
                metadata: (existing.metadata as Record<string, unknown>) ?? {},
              };
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    let imageBase64: string;

    if (image) {
      imageBase64 = image;
    } else if (file_url) {
      try {
        imageBase64 = await fetchImageAsBase64(file_url);
      } catch (err) {
        console.error("Failed to fetch image:", err);
        return new Response(
          JSON.stringify({ error: "Failed to fetch image from URL" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Missing image (base64) or file_url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceRoleKeyForLog = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const routerMode = mode === "router";

    let result: ResponseBody;
    try {
      if (!serviceRoleKeyForLog) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");

      const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKeyForLog, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const run = await runCapability<ResponseBody>(serviceClient, {
        capability: "photo_asset_identification",
        orgId: org_id,
        entity: { type: attachment_id ? "attachment" : null, id: attachment_id ?? null },
        metadata: { mode },
        allowFallback: Deno.env.get("AI_FALLBACK_ENABLED") === "true",
        // Already gated above, before the image was fetched.
        skipGate: true,
        executors: {
          "model:gemini-2.0-flash": () =>
            routerMode ? callGeminiVisionRouter(imageBase64) : callGeminiVision(imageBase64),
          "model:gpt-4o-mini": () =>
            routerMode ? callOpenAIVisionRouter(imageBase64) : callOpenAIVision(imageBase64),
        },
        validate: (raw) => (routerMode ? normalizeRouterResponse(raw) : normalizeResponse(raw)),
      });

      if (!run.ok) console.error("ai-image-analyse extraction failed:", run.error);
      result = run.value ?? stubResponse();
    } catch (err) {
      console.error("ai-image-analyse error:", err);
      result = stubResponse();
    }

    // Phase 2: DB writes when attachment_id provided
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (attachment_id && serviceRoleKey) {
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      try {
        // A) Insert image_analysis_results
        await admin.from("image_analysis_results").insert({
          attachment_id,
          org_id,
          raw_response: result,
          ocr_text: result.ocr_text,
          detected_objects: result.detected_objects,
          metadata: {
            ...result.metadata,
            document_classification: result.document_classification,
            detected_labels: result.detected_labels,
          },
        });

        // B) Update attachments
        const docClass = result.document_classification;
        const expiryDate = docClass?.expiry_date;
        const status = computeExpiryStatus(expiryDate);

        await admin
          .from("attachments")
          .update({
            ocr_text: result.ocr_text,
            document_type: docClass?.type ?? null,
            expiry_date: expiryDate ?? null,
            status,
            metadata: {
              detected_objects: result.detected_objects,
              detected_labels: result.detected_labels,
              document_classification: docClass,
            },
          })
          .eq("id", attachment_id);

        // C) attachment_assets: only if single high-confidence match
        const highConf = result.detected_objects.filter((o) => o.confidence >= 0.6);
        if (highConf.length === 1) {
          const obj = highConf[0];
          const term = obj.serial_number || obj.model || obj.label || obj.type.replace(/_/g, " ");
          if (term) {
            const { data: assets } = await admin
              .from("assets")
              .select("id")
              .eq("org_id", org_id)
              .or(`serial_number.ilike.%${term}%,model.ilike.%${term}%,name.ilike.%${term}%`);

            if (assets && assets.length === 1) {
              try {
                await admin.from("attachment_assets").insert({
                  attachment_id,
                  asset_id: assets[0].id,
                  org_id,
                });
              } catch {
                // Ignore duplicate
              }
            }
          }
        }
      } catch (dbErr) {
        console.error("ai-image-analyse DB write error:", dbErr);
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-image-analyse error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
