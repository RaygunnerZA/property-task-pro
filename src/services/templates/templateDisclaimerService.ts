import { supabase as _supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

export async function fetchOrgStarterDisclaimerAcceptedAt(orgId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("organisations")
    .select("starter_templates_disclaimer_accepted_at")
    .eq("id", orgId)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST204" || error.code === "42703") {
      return null;
    }
    throw error;
  }

  return (data?.starter_templates_disclaimer_accepted_at as string | null) ?? null;
}

export async function acceptOrgStarterTemplateDisclaimer(orgId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("accept_starter_templates_disclaimer", {
    p_org_id: orgId,
  });

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}
