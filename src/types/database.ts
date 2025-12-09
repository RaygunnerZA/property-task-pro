/**
 * Extended database types aligned with the new Supabase schema
 * These complement the auto-generated types in integrations/supabase/types.ts
 */

import type { Tables } from "@/integrations/supabase/types";

// ===== TASK TYPES =====
export type TaskRow = Tables<"tasks">;
export type TaskStatus = "open" | "in_progress" | "completed" | "archived";
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

// ===== GROUP TYPES =====
export type GroupRow = Tables<"groups">;
export type GroupMemberRow = Tables<"group_members">;
export type TaskGroupRow = Tables<"task_groups">;

// ===== CHECKLIST TYPES =====
export type ChecklistTemplateRow = Tables<"checklist_templates">;
export type ChecklistTemplateItemRow = Tables<"checklist_template_items">;

// ===== SUBTASK TYPES =====
export type SubtaskRow = Tables<"subtasks">;

// ===== AI TYPES =====
export type AIModelRow = Tables<"ai_models">;
export type AIPromptRow = Tables<"ai_prompts">;
export type AIResponseRow = Tables<"ai_responses">;
export type AIExtractionRow = Tables<"ai_extractions">;

// ===== LABEL TYPES =====
export type LabelRow = Tables<"labels">;
export type TaskLabelRow = Tables<"task_labels">;

// ===== ACTIVITY LOG =====
export type ActivityLogRow = Tables<"activity_log">;

// ===== COMPLIANCE TYPES =====
export type TaskComplianceEventRow = Tables<"task_compliance_events">;

// ===== PROPERTY & SPACE =====
export type PropertyRow = Tables<"properties">;
export type SpaceRow = Tables<"spaces">;

// ===== TEAM TYPES =====
export type TeamRow = Tables<"teams">;

// ===== SIGNAL TYPES =====
export type SignalRow = Tables<"signals">;
export type SignalSeverity = "info" | "warning" | "urgent" | "critical";
export type SignalScope = "task" | "property" | "org-wide";

// ===== ESCALATION TYPES =====
export type EscalationRuleRow = Tables<"escalation_rules">;
export type EscalationEventRow = Tables<"escalation_events">;

// ===== TASK RECURRENCE =====
export type TaskRecurrenceRow = Tables<"task_recurrence">;

// ===== TASK ACTIVITY =====
export type TaskActivityRow = Tables<"task_activity">;

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
