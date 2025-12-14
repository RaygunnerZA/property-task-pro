// ai-extract — Rule-based Task Extraction Engine
// Returns structured task metadata for Filla Create Task modal.

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST only" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const description = (body.description || "").toString().trim();

  if (!description) {
    return new Response(JSON.stringify({
      ok: true,
      combined: {
        title: "",
        spaces: [],
        people: [],
        assets: [],
        priority: "NORMAL",
        date: "",
        groups: [],
        yes_no: false,
        signature: false
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const lower = description.toLowerCase();

  function extractTitle(text: string) {
    if (text.length <= 60) return text;
    const cut = text.slice(0, 60);
    const lastSpace = cut.lastIndexOf(" ");
    return cut.slice(0, lastSpace > 20 ? lastSpace : 60);
  }

  const spaceKeywords = ["kitchen", "bathroom", "bedroom", "hall", "garage", "shed", "lounge", "living room", "boiler room", "attic"];
  const detectedSpaces = spaceKeywords.filter(s => lower.includes(s));

  const peopleKeywords = ["brian", "mark", "leon", "barbara", "justin"];
  const detectedPeople = peopleKeywords.filter(p => lower.includes(p));

  const assetKeywords = ["tap", "sink", "boiler", "radiator", "window", "door", "pipe", "pump", "nuts", "equipment"];
  const detectedAssets = assetKeywords.filter(a => lower.includes(a));

  let priority = "NORMAL";
  if (["urgent", "asap", "immediately", "leak", "broken", "danger"].some(w => lower.includes(w))) {
    priority = "HIGH";
  }

  let date = "";
  if (lower.includes("tomorrow")) date = "tomorrow";
  if (lower.includes("today")) date = "today";
  if (lower.includes("next week")) date = "next_week";
  if (lower.includes("next friday")) date = "next_friday";

  const yes_no = lower.includes("check if") || lower.includes("confirm if");
  const signature = lower.includes("inspect") || lower.includes("safety") || lower.includes("compliance");

  const combined = {
    title: extractTitle(description),
    spaces: detectedSpaces.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
    people: detectedPeople.map(p => p.charAt(0).toUpperCase() + p.slice(1)),
    assets: detectedAssets,
    priority,
    date,
    groups: [],
    yes_no,
    signature
  };

  console.log("AI Extract processed:", { description: description.substring(0, 50), combined });

  return new Response(JSON.stringify({ ok: true, combined }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
