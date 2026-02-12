// ai-image-analyse — OCR + object detection for task images
// Stateless: no DB writes, no uploads. Returns structured analysis JSON.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  image: string; // base64
  org_id: string;
  property_id?: string | null;
}

interface DetectedObject {
  type: string;
  label: string;
  confidence: number;
  serial_number?: string;
  expiry_date?: string;
}

interface ResponseBody {
  ocr_text: string;
  detected_labels: string[];
  detected_objects: DetectedObject[];
  anomalies: unknown[];
  metadata: Record<string, unknown>;
}

const ANALYSIS_PROMPT = `Analyze this property/maintenance image. Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:

{
  "ocr_text": "All readable text from the image (labels, signs, plates, serial numbers)",
  "detected_labels": ["fire extinguisher", "serial 8844", "expiry 2027", ...],
  "detected_objects": [
    {
      "type": "fire_extinguisher",
      "label": "Fire Extinguisher",
      "confidence": 0.92,
      "serial_number": "8844",
      "expiry_date": "2027-01-01"
    }
  ],
  "anomalies": [],
  "metadata": {}
}

Focus on: appliances (boiler, pump, HVAC), safety equipment (extinguisher, DB board), serial numbers, expiry dates, model names, warnings. Use snake_case for type.`;

function getGeminiKey(): string | undefined {
  return Deno.env.get("GEMINI_API_KEY");
}

function getOpenAIApiKey(): string | undefined {
  return Deno.env.get("OPENAI_API_KEY");
}

async function callGeminiVision(imageBase64: string): Promise<ResponseBody> {
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
  if (!text) throw new Error("Empty Gemini response");

  const parsed = JSON.parse(text) as ResponseBody;
  return {
    ocr_text: parsed.ocr_text ?? "",
    detected_labels: Array.isArray(parsed.detected_labels) ? parsed.detected_labels : [],
    detected_objects: Array.isArray(parsed.detected_objects) ? parsed.detected_objects : [],
    anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : [],
    metadata: parsed.metadata ?? {},
  };
}

async function callOpenAIVision(imageBase64: string): Promise<ResponseBody> {
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
  if (!text) throw new Error("Empty OpenAI response");

  const parsed = JSON.parse(text) as ResponseBody;
  return {
    ocr_text: parsed.ocr_text ?? "",
    detected_labels: Array.isArray(parsed.detected_labels) ? parsed.detected_labels : [],
    detected_objects: Array.isArray(parsed.detected_objects) ? parsed.detected_objects : [],
    anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : [],
    metadata: parsed.metadata ?? {},
  };
}

function stubResponse(): ResponseBody {
  return {
    ocr_text: "",
    detected_labels: [],
    detected_objects: [],
    anomalies: [],
    metadata: { stub: true },
  };
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

    const { image, org_id } = body;

    if (!image || !org_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: image, org_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: ResponseBody;
    try {
      if (getGeminiKey()) {
        result = await callGeminiVision(image);
      } else if (getOpenAIApiKey()) {
        result = await callOpenAIVision(image);
      } else {
        result = stubResponse();
      }
    } catch (err) {
      console.error("ai-image-analyse error:", err);
      result = stubResponse();
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
