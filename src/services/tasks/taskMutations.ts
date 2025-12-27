import { supabase } from "@/integrations/supabase/client";
import type { CreateTaskPayload } from "@/types/database";
import type { Json } from "@/integrations/supabase/types";

/**
 * Create a task using the create_task_safe database function
 * This ensures proper RLS checks and creates all related records
 */
export async function createTask(
  orgId: string,
  propertyId: string | null,
  payload: CreateTaskPayload
) {
  // Build the JSONB payload for the database function - cast to Json for Supabase compatibility
  const dbPayload: Json = {
    title: payload.title,
    description: payload.description || null,
    priority: payload.priority || "medium",
    due_at: payload.due_at || null,
    assigned_user_id: payload.assigned_user_id || null,
    assigned_team_ids: payload.assigned_team_ids || [],
    space_ids: payload.space_ids || [],
    is_compliance: payload.is_compliance || false,
    compliance_level: payload.compliance_level || null,
    annotation_required: payload.annotation_required || false,
    metadata: payload.metadata ? JSON.parse(JSON.stringify(payload.metadata)) : {},
    template_id: payload.template_id || null,
    subtasks: payload.subtasks ? JSON.parse(JSON.stringify(payload.subtasks)) : null,
    categories: payload.categories || [],
    images: payload.images ? JSON.parse(JSON.stringify(payload.images)) : null,
  };

  const { data, error } = await supabase.rpc("create_task_safe", {
    p_org: orgId,
    p_property: propertyId,
    p_payload: dbPayload,
  });

  if (error) {
    console.error("Error creating task:", error);
    throw error;
  }

  return data as string; // Returns the new task UUID
}

/**
 * Update an existing task
 */
export async function updateTaskFields(
  taskId: string,
  updates: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    due_at: string;
    assigned_user_id: string;
    assigned_team_ids: string[];
    space_ids: string[];
    is_compliance: boolean;
    compliance_level: string;
    annotation_required: boolean;
    metadata: Json;
  }>
) {
  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", taskId)
    .select()
    .single();

  if (error) {
    console.error("Error updating task:", error);
    throw error;
  }

  return data;
}

/**
 * Delete a task and all related records
 */
export async function deleteTask(taskId: string, orgId: string) {
  const { error } = await supabase.rpc("delete_task_full", {
    p_task_id: taskId,
    p_org: orgId,
  });

  if (error) {
    console.error("Error deleting task:", error);
    throw error;
  }

  return true;
}

/**
 * Archive a task (soft delete)
 */
export async function archiveTask(taskId: string, orgId: string) {
  const { error } = await supabase.rpc("archive_task", {
    p_task_id: taskId,
    p_org: orgId,
  });

  if (error) {
    console.error("Error archiving task:", error);
    throw error;
  }

  return true;
}

/**
 * Restore an archived task
 */
export async function restoreTask(taskId: string, orgId: string) {
  const { error } = await supabase.rpc("restore_task", {
    p_task_id: taskId,
    p_org: orgId,
  });

  if (error) {
    console.error("Error restoring task:", error);
    throw error;
  }

  return true;
}

/**
 * Apply a checklist template to a task
 */
export async function applyTemplateToTask(
  taskId: string,
  templateId: string,
  orgId: string
) {
  const { error } = await supabase.rpc("apply_checklist_template", {
    p_task: taskId,
    p_template: templateId,
    p_org: orgId,
  });

  if (error) {
    console.error("Error applying template:", error);
    throw error;
  }

  return true;
}
