// ai-doc-analyse — Analyse property documents and suggest metadata + links
// Stub: returns basic metadata; can be extended with real AI (e.g. document parsing)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  file_url: string;
  file_name: string;
  property_id: string;
  org_id: string;
}

interface ResponseBody {
  title?: string;
  category?: string;
  document_type?: string;
  expiry_date?: string;
  suggested_links?: {
    spaces?: string[];
    assets?: string[];
    contractors?: string[];
    compliance?: string[];
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

    const { file_url, file_name, property_id, org_id } = body;

    if (!file_url || !file_name || !org_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields: file_url, file_name, org_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stub: derive title from filename (strip extension)
    const title = file_name.replace(/\.[^/.]+$/, "") || "Untitled";
    const category = inferCategory(file_name);
    const document_type = inferDocumentType(file_name);

    const result: ResponseBody = {
      title,
      category,
      document_type,
      expiry_date: undefined,
      suggested_links: undefined,
    };

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

function inferCategory(fileName: string): string | undefined {
  const lower = fileName.toLowerCase();
  if (lower.includes("plan") || lower.includes("drawing")) return "Plans";
  if (lower.includes("lease") || lower.includes("contract") || lower.includes("legal")) return "Legal";
  if (lower.includes("fire") || lower.includes("safety")) return "Fire Safety";
  if (lower.includes("electrical") || lower.includes("EIC")) return "Electrical";
  if (lower.includes("gas") || lower.includes(" mechanical") || lower.includes("hvac")) return "Mechanical";
  if (lower.includes("water") || lower.includes("plumb")) return "Water";
  if (lower.includes("insurance")) return "Insurance";
  if (lower.includes("warrant")) return "Warranties";
  if (lower.includes("om ") || lower.includes("o&m") || lower.includes("manual")) return "O&M Manuals";
  return "Misc";
}

function inferDocumentType(fileName: string): string | undefined {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "PDF";
  if (["doc", "docx"].includes(ext || "")) return "Word";
  if (["xls", "xlsx"].includes(ext || "")) return "Excel";
  if (ext === "txt") return "Text";
  if (ext === "csv") return "CSV";
  return undefined;
}
