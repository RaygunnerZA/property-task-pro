import { supabase as _supabase } from '@/integrations/supabase/client';
// pending-migration tables — cast until schema is generated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import type { ChecklistTemplateCategory } from "@/hooks/useChecklistTemplates";
import {
  parseChecklistTemplateItems,
  serializeChecklistTemplateItems,
  type ChecklistTemplateItemJson,
} from "@/lib/checklistTemplateItems";
import { getStepType, stepTypeToLegacy } from "@/components/tasks/subtasks/stepTypes";

function isMissingColumnError(
  error: { code?: string; message?: string } | null,
  column: string
): boolean {
  if (!error) return false;
  return error.code === "PGRST204" && (error.message?.includes(`'${column}'`) ?? false);
}

function usesLegacyTemplateItems(error: { code?: string; message?: string } | null): boolean {
  return isMissingColumnError(error, "items") || isMissingColumnError(error, "category");
}

export type TemplateItem = ChecklistTemplateItemJson;

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

async function insertLegacyTemplateItems(
  orgId: string,
  templateId: string,
  items: TemplateItem[]
) {
  if (items.length === 0) return { error: null };

  const rows = items.map((item, index) => {
    const legacy = stepTypeToLegacy(getStepType(item));
    return {
      org_id: orgId,
      template_id: templateId,
      title: item.title,
      order_index: index,
      is_yes_no: legacy.is_yes_no,
      requires_signature: legacy.requires_signature,
      is_archived: false,
    };
  });

  return supabase.from("checklist_template_items").insert(rows);
}

async function replaceLegacyTemplateItems(
  orgId: string,
  templateId: string,
  items: TemplateItem[]
) {
  await supabase
    .from("checklist_template_items")
    .delete()
    .eq("template_id", templateId)
    .eq("org_id", orgId);

  return insertLegacyTemplateItems(orgId, templateId, items);
}

async function saveTemplateLegacy({ orgId, name, items }: SaveTemplateArgs) {
  const { data, error } = await supabase
    .from("checklist_templates")
    .insert({ org_id: orgId, name })
    .select("id")
    .single();

  if (error || !data?.id) {
    return { data, error };
  }

  const itemsError = (await insertLegacyTemplateItems(orgId, data.id, items)).error;
  if (itemsError) {
    return { data: null, error: itemsError };
  }

  return { data, error: null };
}

async function updateTemplateLegacy({
  orgId,
  templateId,
  name,
  items,
}: UpdateTemplateArgs) {
  const { error: templateError } = await supabase
    .from("checklist_templates")
    .update({ name })
    .eq("id", templateId)
    .eq("org_id", orgId);

  if (templateError) {
    return { error: templateError };
  }

  const itemsError = (await replaceLegacyTemplateItems(orgId, templateId, items)).error;
  return { error: itemsError };
}

export async function saveTemplate(args: SaveTemplateArgs) {
  const { orgId, name, category, items } = args;
  const payload = { org_id: orgId, name, category, items };
  const result = await supabase.from("checklist_templates").insert(payload).select("id").single();

  if (usesLegacyTemplateItems(result.error)) {
    return saveTemplateLegacy(args);
  }

  return result;
}

export async function updateTemplate(args: UpdateTemplateArgs) {
  const { orgId, templateId, name, category, items } = args;
  const payload = { name, category, items };
  const result = await supabase
    .from("checklist_templates")
    .update(payload)
    .eq("id", templateId)
    .eq("org_id", orgId);

  if (usesLegacyTemplateItems(result.error)) {
    return updateTemplateLegacy(args);
  }

  return result;
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
  return saveTemplate({ orgId, name: newName, category, items });
}

export function normalizeItems(
  items: Array<
    | {
        title: string;
        is_yes_no?: boolean;
        requires_signature?: boolean;
        step_type?: string;
        is_sub_step?: boolean;
        is_required?: boolean;
      }
    | string
  >
): TemplateItem[] {
  return serializeChecklistTemplateItems(parseChecklistTemplateItems(items));
}

/** Map legacy checklist_template_items rows to JSONB item shape. */
export function legacyTemplateItemsToJson(
  rows: Array<{
    title: string;
    is_yes_no?: boolean | null;
    requires_signature?: boolean | null;
    order_index?: number | null;
  }>
): TemplateItem[] {
  return serializeChecklistTemplateItems(
    [...rows]
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map((row) => ({
        title: row.title,
        is_yes_no: Boolean(row.is_yes_no),
        requires_signature: Boolean(row.requires_signature),
      }))
  );
}
