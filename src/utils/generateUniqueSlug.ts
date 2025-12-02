import { supabase } from "@/integrations/supabase/client";

function baseSlugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function generateUniqueSlug(name: string): Promise<string> {
  const base = baseSlugify(name) || "organisation";
  
  // Check if base slug is free
  let { data } = await supabase
    .from("organisations")
    .select("slug")
    .eq("slug", base);

  if (!data || data.length === 0) return base;

  // Otherwise increment: base-1, base-2, base-3, ...
  let counter = 1;

  while (true) {
    const candidate = `${base}-${counter}`;
    const { data: exists } = await supabase
      .from("organisations")
      .select("slug")
      .eq("slug", candidate);

    if (!exists || exists.length === 0) {
      return candidate;
    }

    counter++;
  }
}

