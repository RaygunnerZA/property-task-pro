// ai-extract — Rule-based Task Extraction Engine
// Returns structured task metadata for Filla Create Task modal.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST only" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const description = (body.description || "").toString().trim();

  if (!description) {
    return new Response(
      JSON.stringify({
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
          signature: false,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const lower = description.toLowerCase();

  // Generate a simplified title (not repeating full description)
  function extractTitle(text: string): string {
    // First try to extract action phrase
    const actionWords = ["fix", "repair", "check", "inspect", "replace", "install", "clean", "paint", "move", "update"];
    const words = text.split(/\s+/);
    
    // Find first action word and build title from there
    for (let i = 0; i < words.length && i < 3; i++) {
      if (actionWords.some(a => words[i].toLowerCase().startsWith(a))) {
        const titleWords = words.slice(i, Math.min(i + 6, words.length));
        return titleWords.join(" ").replace(/[.,!?]+$/, "");
      }
    }
    
    // Fallback: use first 60 chars
    if (text.length <= 60) return text.trim();
    const cut = text.slice(0, 60);
    const lastSpace = cut.lastIndexOf(" ");
    return cut.slice(0, lastSpace > 20 ? lastSpace : 60).trim();
  }

  // Space detection
  const spaceKeywords = [
    "kitchen",
    "bathroom",
    "bedroom",
    "hall",
    "hallway",
    "garage",
    "shed",
    "lounge",
    "living room",
    "boiler room",
    "attic",
    "basement",
    "office",
    "garden",
    "utility room",
    "dining room",
  ];
  const detectedSpaces = spaceKeywords.filter((s) => lower.includes(s));

  // People detection
  const peopleKeywords = ["brian", "mark", "leon", "barbara", "justin", "john", "jane", "sarah", "mike", "david"];
  const detectedPeople = peopleKeywords.filter((p) => lower.includes(p));

  // Asset detection
  const assetKeywords = [
    "tap",
    "sink",
    "boiler",
    "radiator",
    "window",
    "door",
    "pipe",
    "pump",
    "nuts",
    "equipment",
    "toilet",
    "shower",
    "heater",
    "washing machine",
    "dishwasher",
    "fridge",
    "oven",
    "light",
    "switch",
    "socket",
    "outlet",
  ];
  const detectedAssets = assetKeywords.filter((a) => lower.includes(a));

  // Priority detection
  let priority = "NORMAL";
  const urgentWords = ["urgent", "asap", "immediately", "leak", "leaking", "broken", "danger", "dangerous", "emergency", "flood", "flooding", "fire"];
  if (urgentWords.some((w) => lower.includes(w))) {
    priority = "HIGH";
  }

  // Date detection
  let date = "";
  if (lower.includes("tomorrow")) date = "tomorrow";
  else if (lower.includes("today")) date = "today";
  else if (lower.includes("next week")) date = "next_week";
  else if (lower.includes("next friday")) date = "next_friday";
  else if (lower.includes("next monday")) date = "next_monday";

  // Yes/No requirement detection
  const yes_no =
    lower.includes("check if") ||
    lower.includes("confirm if") ||
    lower.includes("yes or no") ||
    lower.includes("is it");

  // Signature/Compliance detection
  const signature =
    lower.includes("inspect") ||
    lower.includes("safety") ||
    lower.includes("compliance") ||
    lower.includes("certificate") ||
    lower.includes("sign off");

  // Build response
  const combined = {
    title: extractTitle(description),
    spaces: detectedSpaces.map((s) => s.charAt(0).toUpperCase() + s.slice(1)),
    people: detectedPeople.map((p) => p.charAt(0).toUpperCase() + p.slice(1)),
    assets: detectedAssets.map((a) => a.charAt(0).toUpperCase() + a.slice(1)),
    priority,
    date,
    groups: [],
    yes_no,
    signature,
  };

  console.log("AI Extract processed:", {
    descriptionPreview: description.slice(0, 50),
    combined,
  });

  return new Response(JSON.stringify({ ok: true, combined }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
