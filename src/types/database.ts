/**
 * Extended database types aligned with the Supabase schema.
 * Row types that exist in the generated schema use Tables<"x">.
 * Tables that were planned but not yet migrated use hand-written interfaces
 * (marked // pending-migration) to keep tsc clean without faking the schema.
 */

import type { Tables } from "@/integrations/supabase/types";

// ===== TASK TYPES =====
export type TaskRow = Tables<"tasks">;
export type TaskStatus = "open" | "in_progress" | "waiting_review" | "completed" | "archived";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskMetadata {
  repeat?: RepeatRule;
  ai?: AIMetadata;
  compliance?: ComplianceMetadata;
  [key: string]: unknown;
}

export interface RepeatRule {
  type: "daily" | "weekly" | "monthly";
  interval: number;
  day?: string;
  weekend_push?: boolean;
}

export interface AIMetadata {
  suggested_title?: string;
  chips?: string[];
  model?: string;
  confidence?: number;
}

export interface ComplianceMetadata {
  rule_id?: string;
  auto_created?: boolean;
}

// ===== CATEGORY TYPES =====
// pending-migration: categories / category_members / task_categories not in generated schema
export interface CategoryRow {
  id: string;
  name: string;
  org_id: string;
  color?: string | null;
  icon?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}
export interface CategoryMemberRow {
  id: string;
  category_id: string;
  user_id: string;
  created_at?: string;
  [key: string]: unknown;
}
export interface TaskCategoryRow {
  id: string;
  task_id: string;
  category_id: string;
  created_at?: string;
  [key: string]: unknown;
}

// ===== CHECKLIST TYPES =====
export type ChecklistTemplateRow = Tables<"checklist_templates">;
// pending-migration: checklist_template_items are stored as JSONB in checklist_templates.items
export interface ChecklistTemplateItemRow {
  id: string;
  template_id: string;
  title: string;
  is_yes_no?: boolean;
  requires_signature?: boolean;
  order_index?: number;
  [key: string]: unknown;
}

// ===== SUBTASK TYPES =====
// pending-migration: subtasks table not in generated schema; subtasks stored as JSONB
export interface SubtaskRow {
  id: string;
  task_id?: string;
  title: string;
  is_yes_no?: boolean;
  requires_signature?: boolean;
  is_complete?: boolean;
  order_index?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

// ===== AI TYPES =====
// pending-migration: ai_models / ai_prompts / ai_responses / ai_extractions not in generated schema
export interface AIModelRow {
  id: string;
  name: string;
  provider?: string | null;
  [key: string]: unknown;
}
export interface AIPromptRow {
  id: string;
  name: string;
  template?: string | null;
  [key: string]: unknown;
}
export interface AIResponseRow {
  id: string;
  prompt_id?: string | null;
  response?: string | null;
  created_at?: string;
  [key: string]: unknown;
}
export interface AIExtractionRow {
  id: string;
  org_id?: string | null;
  task_id?: string | null;
  extracted_data?: Record<string, unknown> | null;
  created_at?: string;
  [key: string]: unknown;
}

// ===== LABEL TYPES =====
// pending-migration: labels / task_labels not in generated schema
export interface LabelRow {
  id: string;
  name: string;
  color?: string | null;
  org_id?: string | null;
  created_at?: string;
  [key: string]: unknown;
}
export interface TaskLabelRow {
  id: string;
  task_id: string;
  label_id: string;
  created_at?: string;
  [key: string]: unknown;
}

// ===== ACTIVITY LOG =====
// pending-migration: activity_log not in generated schema (audit_logs is the live equivalent)
export interface ActivityLogRow {
  id: string;
  org_id?: string | null;
  actor_id?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  [key: string]: unknown;
}

// ===== COMPLIANCE TYPES =====
// pending-migration: task_compliance_events not in generated schema (task_compliance is live)
export interface TaskComplianceEventRow {
  id: string;
  task_id?: string | null;
  event_type?: string | null;
  occurred_at?: string | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
}

// ===== PROPERTY & SPACE =====
export type PropertyRow = Tables<"properties">;
export type SpaceRow = Tables<"spaces">;

// ===== TEAM TYPES =====
export type TeamRow = Tables<"teams">;

// ===== SIGNAL TYPES =====
// pending-migration: signals table not in generated schema
export interface SignalRow {
  id: string;
  org_id?: string | null;
  property_id?: string | null;
  task_id?: string | null;
  type?: string | null;
  severity?: string | null;
  message?: string | null;
  resolved?: boolean | null;
  created_at?: string;
  [key: string]: unknown;
}
export type SignalSeverity = "info" | "warning" | "urgent" | "critical";
export type SignalScope = "task" | "property" | "org-wide";

// ===== ESCALATION TYPES =====
// pending-migration: escalation_rules / escalation_events not in generated schema
export interface EscalationRuleRow {
  id: string;
  org_id?: string | null;
  name?: string | null;
  conditions?: Record<string, unknown> | null;
  actions?: Record<string, unknown> | null;
  [key: string]: unknown;
}
export interface EscalationEventRow {
  id: string;
  rule_id?: string | null;
  task_id?: string | null;
  fired_at?: string | null;
  [key: string]: unknown;
}

// ===== TASK RECURRENCE =====
// pending-migration: task_recurrence not in generated schema (repeat rules stored in task metadata)
export interface TaskRecurrenceRow {
  id: string;
  task_id?: string | null;
  rule?: RepeatRule | null;
  next_due_at?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

// ===== TASK ACTIVITY =====
// pending-migration: task_activity not in generated schema
export interface TaskActivityRow {
  id: string;
  task_id?: string | null;
  actor_id?: string | null;
  action?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

// ===== GROUP ROW =====
// Groups are backed by themes with type='group' (groups table replaced in migration 20251220000032).
export interface GroupRow {
  id: string;
  name?: string | null;
  [key: string]: unknown;
}

// ===== EXTENDED TASK WITH RELATIONS =====
export interface TaskWithRelations extends TaskRow {
  property?: PropertyRow | null;
  spaces?: SpaceRow[];
  subtasks?: SubtaskRow[];
  labels?: LabelRow[];
  groups?: GroupRow[];
}

// ===== CREATE TASK PAYLOAD =====
export interface CreateTaskPayload {
  title: string;
  description?: string;
  property_id?: string;
  space_ids?: string[];
  priority?: TaskPriority;
  due_at?: string;
  assigned_user_id?: string;
  assigned_team_ids?: string[];
  is_compliance?: boolean;
  compliance_level?: string;
  annotation_required?: boolean;
  metadata?: TaskMetadata;
  template_id?: string;
  subtasks?: CreateSubtaskPayload[];
  groups?: string[];
  images?: CreateTaskImagePayload[];
}

export interface CreateSubtaskPayload {
  title: string;
  is_yes_no?: boolean;
  requires_signature?: boolean;
  order_index?: number;
}

export interface CreateTaskImagePayload {
  storage_path: string;
  image_url: string;
  original_filename?: string;
  display_name?: string;
  file_type?: string;
}

// ===== CALENDAR EVENT TYPES =====
export interface CalendarTaskEvent {
  id: string;
  title: string;
  due_at: string;
  priority: TaskPriority;
  is_compliance: boolean;
  status: TaskStatus;
  property_id?: string;
}
