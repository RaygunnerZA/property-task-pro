// seed-property — Property Seeding Edge Function
// Automatically creates themes, spaces, and property_details when a property is created
// Triggered by database webhook on properties INSERT

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// TAXONOMY DATA (duplicated from src/lib/taxonomy.ts for Deno compatibility)
// ============================================================================

const DEFAULT_THEMES = {
  "Ownership & Legal": [
    "Lease",
    "Deeds",
    "Insurance",
    "Licences",
  ],
  Compliance: [
    "Fire Safety",
    "Electrical Safety",
    "Mechanical Safety",
    "Water Hygiene",
    "Asbestos",
    "Accessibility",
    "Energy (EPC)",
  ],
  "Asset Register": [
    "Mechanical",
    "Electrical",
    "Safety Systems",
    "Water Systems",
    "Lifts & Transport",
    "IT/AV",
    "Fabric",
  ],
  Utilities: [
    "Electricity",
    "Gas",
    "Water",
    "Broadband",
    "Solar",
  ],
  Contractors: [
    "Fire",
    "HVAC",
    "Electrical",
    "Plumbing",
    "Cleaning",
    "Waste",
    "Security",
    "Lifts",
    "Roofing",
    "Landscaping",
  ],
} as const;

const SPACE_TEMPLATES = {
  Circulation: ["Corridor", "Hallway", "Staircase", "Landing", "Lobby"],
  Habitable: [
    "Bedroom",
    "Living Room",
    "Office",
    "Meeting Room",
    "Classroom",
    "Sales Floor",
    "Workshop",
    "Studio",
  ],
  Service: [
    "Kitchen",
    "Break Area",
    "Utility Room",
    "Print Room",
    "Tea Point",
    "Staff Room",
  ],
  Sanitary: [
    "Bathroom",
    "Shower",
    "WC",
    "Disabled WC",
    "Changing Rooms",
  ],
  Storage: [
    "General Store",
    "Stock Room",
    "Archive",
    "Cupboard",
  ],
  Technical: [
    "Plant Room",
    "Server Room",
    "Electrical Room",
    "Boiler Room",
    "UPS Room",
    "Riser",
    "HVAC Room",
    "Lift Motor Room",
  ],
  External: [
    "Garden",
    "Terrace",
    "Car Park",
    "Loading Bay",
    "Yard",
    "Roof",
  ],
} as const;

// Theme group colors (matching design system)
const THEME_COLORS: Record<string, string> = {
  "Ownership & Legal": "#EB6834", // Coral
  Compliance: "#EB6834", // Coral
  "Asset Register": "#96CEB4", // Sage
  Utilities: "#8EC9CE", // Teal
  Contractors: "#4ECDC4", // Teal variant
};

const THEME_ICONS: Record<string, string> = {
  "Ownership & Legal": "file-text",
  Compliance: "shield-check",
  "Asset Register": "package",
  Utilities: "zap",
  Contractors: "users",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

// ============================================================================
// SEEDING LOGIC
// ============================================================================

async function createOrGetTheme(
  orgId: string,
  name: string,
  type: string,
  parentId: string | null = null,
  color?: string,
  icon?: string
): Promise<string | null> {
  // Check if theme already exists
  const { data: existing } = await supabase
    .from("themes")
    .select("id")
    .eq("org_id", orgId)
    .eq("name", name)
    .eq("type", type)
    .eq("parent_id", parentId)
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  // Create new theme
  const { data, error } = await supabase
    .from("themes")
    .insert({
      org_id: orgId,
      name,
      type,
      parent_id: parentId,
      color: color || null,
      icon: icon || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error(`Error creating theme ${name}:`, error);
    return null;
  }

  return data?.id || null;
}

async function linkThemeToProperty(
  propertyId: string,
  themeId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("property_themes")
    .insert({
      property_id: propertyId,
      theme_id: themeId,
    });

  if (error) {
    // Ignore duplicate key errors (theme already linked)
    if (error.code !== "23505") {
      console.error(`Error linking theme to property:`, error);
      return false;
    }
  }

  return true;
}

async function createCategorySpace(
  orgId: string,
  propertyId: string,
  categoryName: string
): Promise<boolean> {
  // Check if category space already exists
  const { data: existing } = await supabase
    .from("spaces")
    .select("id")
    .eq("org_id", orgId)
    .eq("property_id", propertyId)
    .eq("name", categoryName)
    .maybeSingle();

  if (existing?.id) {
    return true; // Already exists
  }

  // Create category space
  const { error } = await supabase
    .from("spaces")
    .insert({
      org_id: orgId,
      property_id: propertyId,
      name: categoryName,
      space_type: "category", // Mark as category bucket
    });

  if (error) {
    console.error(`Error creating space ${categoryName}:`, error);
    return false;
  }

  return true;
}

async function createPropertyDetails(
  propertyId: string,
  orgId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("property_details")
    .insert({
      property_id: propertyId,
      org_id: orgId,
    });

  if (error) {
    // Ignore duplicate key errors (details already exist)
    if (error.code !== "23505") {
      console.error(`Error creating property details:`, error);
      return false;
    }
  }

  return true;
}

// ============================================================================
// MAIN SEEDING FUNCTION
// ============================================================================

async function seedProperty(propertyId: string, orgId: string) {
  console.log(`Seeding property ${propertyId} for org ${orgId}`);

  try {
    // Step 1: Create property_details row
    await createPropertyDetails(propertyId, orgId);
    console.log("✓ Created property_details");

    // Step 2: Create/Link Themes
    // Iterate through DEFAULT_THEMES
    for (const [groupName, childThemes] of Object.entries(DEFAULT_THEMES)) {
      // Create parent theme (group)
      const parentThemeId = await createOrGetTheme(
        orgId,
        groupName,
        "group",
        null,
        THEME_COLORS[groupName],
        THEME_ICONS[groupName]
      );

      if (!parentThemeId) {
        console.error(`Failed to create parent theme: ${groupName}`);
        continue;
      }

      // Link parent to property
      await linkThemeToProperty(propertyId, parentThemeId);

      // Create child themes and link them
      for (const childThemeName of childThemes) {
        const childThemeId = await createOrGetTheme(
          orgId,
          childThemeName,
          "category", // Child themes are categories
          parentThemeId,
          undefined, // Inherit parent color
          undefined // Inherit parent icon
        );

        if (childThemeId) {
          await linkThemeToProperty(propertyId, childThemeId);
        }
      }

      console.log(`✓ Created/linked themes for group: ${groupName}`);
    }

    // Step 3: Create Category Spaces (top-level buckets only)
    const categoryNames = Object.keys(SPACE_TEMPLATES);
    for (const categoryName of categoryNames) {
      await createCategorySpace(orgId, propertyId, categoryName);
    }
    console.log(`✓ Created ${categoryNames.length} category spaces`);

    return { success: true };
  } catch (error) {
    console.error("Error seeding property:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError("POST only", 405);
  }

  try {
    const body = await req.json();

    // Extract property data from webhook payload
    // Supabase webhooks send: { type: 'INSERT', table: 'properties', record: {...} }
    const record = body.record || body;

    if (!record.id || !record.org_id) {
      return jsonError("Missing property id or org_id", 400);
    }

    const propertyId = record.id;
    const orgId = record.org_id;

    // Seed the property
    const result = await seedProperty(propertyId, orgId);

    if (result.success) {
      return jsonResponse({
        success: true,
        message: `Property ${propertyId} seeded successfully`,
      });
    } else {
      return jsonError(result.error || "Seeding failed", 500);
    }
  } catch (error) {
    console.error("Request error:", error);
    return jsonError(`Invalid request: ${error}`, 400);
  }
});

