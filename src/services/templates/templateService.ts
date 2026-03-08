import { supabase } from "@/integrations/supabase/client";
import type { ChecklistTemplateCategory } from "@/hooks/useChecklistTemplates";

export interface TemplateItem {
  title: string;
  is_yes_no: boolean;
  requires_signature: boolean;
}

export interface SaveTemplateArgs {
  orgId: string;
  name: string;
  category: ChecklistTemplateCategory;
  items: TemplateItem[];
}

export interface UpdateTemplateArgs {
  orgId: string;
  templateId: string;
  name: string;
  category: ChecklistTemplateCategory;
  items: TemplateItem[];
}

export async function saveTemplate({ orgId, name, category, items }: SaveTemplateArgs) {
  return supabase
    .from("checklist_templates")
    .insert({ org_id: orgId, name, category, items })
    .select("id")
    .single();
}

export async function updateTemplate({ orgId, templateId, name, category, items }: UpdateTemplateArgs) {
  return supabase
    .from("checklist_templates")
    .update({ name, category, items })
    .eq("id", templateId)
    .eq("org_id", orgId);
}

export async function archiveTemplate(orgId: string, templateId: string) {
  return supabase
    .from("checklist_templates")
    .update({ is_archived: true })
    .eq("id", templateId)
    .eq("org_id", orgId);
}

export async function duplicateTemplate(
  orgId: string,
  templateId: string,
  newName: string,
  items: TemplateItem[],
  category: ChecklistTemplateCategory
) {
  return supabase
    .from("checklist_templates")
    .insert({ org_id: orgId, name: newName, category, items })
    .select("id")
    .single();
}

export function normalizeItems(
  items: Array<{ title: string; is_yes_no?: boolean; requires_signature?: boolean } | string>
): TemplateItem[] {
  return items
    .map((item) => {
      if (typeof item === "string") {
        const title = item.trim();
        return title ? { title, is_yes_no: false, requires_signature: false } : null;
      }
      const title = (item.title ?? "").trim();
      return title
        ? {
            title,
            is_yes_no: Boolean(item.is_yes_no),
            requires_signature: Boolean(item.requires_signature),
          }
        : null;
    })
    .filter((item): item is TemplateItem => item !== null);
}
