import { supabase } from "@/integrations/supabase/client";

export type OrgPropertyListRow = {
  id: string;
  org_id: string | null;
  address: string;
  nickname: string | null;
  thumbnail_url: string | null;
  icon_name: string | null;
  icon_color_hex: string | null;
  owner_name: string | null;
  owner_email: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string | null;
  updated_at: string;
  open_tasks_count: number;
  assets_count: number;
  spaces_count: number;
  expired_compliance_count: number;
  valid_compliance_count: number;
};

const PROPERTY_LIST_COLUMNS =
  "id, org_id, address, nickname, thumbnail_url, icon_name, icon_color_hex, owner_name, owner_email, contact_name, contact_email, contact_phone, created_at, updated_at";

/**
 * Property list for the workbench. Reads `properties` directly.
 * `properties_view` joins tasks × assets × org-level compliance × spaces before
 * grouping, which statement-timeouts once a property has real operational data.
 */
export async function fetchOrgPropertiesList(orgId: string): Promise<OrgPropertyListRow[]> {
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_LIST_COLUMNS)
    .eq("org_id", orgId)
    .eq("is_archived", false);

  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const today = new Date().toISOString().slice(0, 10);

  const [tasksRes, assetsRes, spacesRes, complianceRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("property_id, status")
      .eq("org_id", orgId)
      .in("property_id", ids)
      .in("status", ["open", "in_progress"]),
    supabase.from("assets").select("property_id").eq("org_id", orgId).in("property_id", ids),
    supabase.from("spaces").select("property_id").eq("org_id", orgId).in("property_id", ids),
    supabase
      .from("compliance_documents")
      .select("property_id, expiry_date")
      .eq("org_id", orgId)
      .in("property_id", ids),
  ]);

  const openTasks = new Map<string, number>();
  for (const row of tasksRes.data ?? []) {
    if (!row.property_id) continue;
    openTasks.set(row.property_id, (openTasks.get(row.property_id) ?? 0) + 1);
  }

  const assets = new Map<string, number>();
  for (const row of assetsRes.data ?? []) {
    if (!row.property_id) continue;
    assets.set(row.property_id, (assets.get(row.property_id) ?? 0) + 1);
  }

  const spaces = new Map<string, number>();
  for (const row of spacesRes.data ?? []) {
    if (!row.property_id) continue;
    spaces.set(row.property_id, (spaces.get(row.property_id) ?? 0) + 1);
  }

  const expiredCompliance = new Map<string, number>();
  const validCompliance = new Map<string, number>();
  for (const row of complianceRes.data ?? []) {
    if (!row.property_id) continue;
    const expired = typeof row.expiry_date === "string" && row.expiry_date < today;
    const target = expired ? expiredCompliance : validCompliance;
    target.set(row.property_id, (target.get(row.property_id) ?? 0) + 1);
  }

  return rows.map((row) => ({
    ...row,
    open_tasks_count: openTasks.get(row.id) ?? 0,
    assets_count: assets.get(row.id) ?? 0,
    spaces_count: spaces.get(row.id) ?? 0,
    expired_compliance_count: expiredCompliance.get(row.id) ?? 0,
    valid_compliance_count: validCompliance.get(row.id) ?? 0,
  }));
}
