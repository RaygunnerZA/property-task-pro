/**
 * useCreateTaskForm
 *
 * Owns all form field state for CreateTaskModal: field values, initialization
 * effects, pure form handlers, and the reset function.
 *
 * Deliberately has no knowledge of:
 *  - AI/chip extraction (see useCreateTaskAIPipeline)
 *  - Task submission / Supabase writes (stays in CreateTaskModal)
 *  - JSX rendering
 *
 * Extracted from CreateTaskModal.tsx (Tier 3 — t3-modal).
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useLastUsedProperty } from "@/hooks/useLastUsedProperty";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useSpaces } from "@/hooks/useSpaces";
import { useTeams } from "@/hooks/useTeams";
import { useCategories } from "@/hooks/useCategories";
import { useChecklistTemplates } from "@/hooks/useChecklistTemplates";
import type { ChecklistTemplateCategory } from "@/hooks/useChecklistTemplates";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { includesMeetingSignal, minuteKeyFromDate } from "./createTaskModalMeetingSignals";
import type { SubtaskInput } from "./SubtasksSection";
import { presetItemsToSubtasks, type PresetTemplate } from "@/data/presetTemplates";
import type { PendingTaskFile } from "./ImageUploadSection";
import type { MilestoneItem } from "./WhenSection";
import type { PendingInvitation } from "./tabs/WhoTab";
import type { CreateTaskPrefill } from "../CreateTaskModal";
import type { TaskPriority, RepeatRule } from "@/types/database";
import type { TempImage } from "@/types/temp-image";

type ChecklistTemplateDialogMode = "save" | "edit" | "duplicate";

export interface UseCreateTaskFormProps {
  open: boolean;
  defaultPropertyId?: string;
  prefillFromLastUsedProperty?: boolean;
  defaultDueDate?: string;
  defaultSpaceIds?: string[];
  defaultAssetIds?: string[];
  prefill?: CreateTaskPrefill | null;
}

export function useCreateTaskForm({
  open,
  defaultPropertyId,
  prefillFromLastUsedProperty = true,
  defaultDueDate,
  defaultSpaceIds,
  defaultAssetIds,
  prefill,
}: UseCreateTaskFormProps) {
  const { toast } = useToast();
  const { orgId } = useActiveOrg();
  const { lastUsedPropertyId, setLastUsed } = useLastUsedProperty();
  const { members, refresh: refreshMembers } = useOrgMembers();
  const { data: existingTasks = [] } = useTasksQuery();
  const { templates, refresh: refreshChecklistTemplates } = useChecklistTemplates(open);

  // ─── Core form fields ────────────────────────────────────────────────────

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [propertyId, setPropertyId] = useState(defaultPropertyId || "");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>(
    defaultPropertyId ? [defaultPropertyId] : []
  );
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [priorityTouched, setPriorityTouched] = useState(false);
  const [dueDate, setDueDate] = useState(defaultDueDate || "");
  const [repeatRule, setRepeatRule] = useState<RepeatRule | undefined>();
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [assignedUserId, setAssignedUserId] = useState<string | undefined>();
  const [assignedTeamIds, setAssignedTeamIds] = useState<string[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [isCompliance, setIsCompliance] = useState(false);
  const [complianceLevel, setComplianceLevel] = useState("");
  const [annotationRequired, setAnnotationRequired] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [recentTemplateIds, setRecentTemplateIds] = useState<string[]>([]);
  const [templateDialogMode, setTemplateDialogMode] = useState<ChecklistTemplateDialogMode | null>(null);
  const [templateDraftName, setTemplateDraftName] = useState("");
  const [templateDraftCategory, setTemplateDraftCategory] = useState<ChecklistTemplateCategory>("operations");
  const [subtasks, setSubtasks] = useState<SubtaskInput[]>([]);
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [images, setImages] = useState<TempImage[]>([]);
  const [taskFiles, setTaskFiles] = useState<PendingTaskFile[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [invitePrefill, setInvitePrefill] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
  } | null>(null);
  const [pendingTemplateImport, setPendingTemplateImport] = useState<{
    subtasks: SubtaskInput[];
    templateId: string;
    templateName: string;
  } | null>(null);
  const [showArchiveTemplateDialog, setShowArchiveTemplateDialog] = useState(false);

  // ─── Derived data ────────────────────────────────────────────────────────

  const { spaces } = useSpaces(propertyId || undefined);
  const { teams } = useTeams();
  const { categories } = useCategories();

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templateId, templates]
  );

  const recentStorageKey = useMemo(
    () => `filla-checklist-recent:${orgId ?? "anon"}`,
    [orgId]
  );

  const scheduleConflictNote = useMemo(() => {
    if (!assignedUserId || assignedUserId.startsWith("pending-")) return null;
    if (!dueDate || !dueDate.includes("T")) return null;
    const draftDate = new Date(dueDate);
    if (Number.isNaN(draftDate.getTime())) return null;
    const draftMinuteKey = minuteKeyFromDate(draftDate);
    const assigneeName =
      members.find((m) => m.user_id === assignedUserId)?.display_name || "This assignee";
    const sameMinuteAssigned = (existingTasks as Array<Record<string, unknown>>).filter((task) => {
      if (task?.assigned_user_id !== assignedUserId) return false;
      if (!task?.due_date) return false;
      const existingDate = new Date(task.due_date as string);
      if (Number.isNaN(existingDate.getTime())) return false;
      return minuteKeyFromDate(existingDate) === draftMinuteKey;
    });
    if (sameMinuteAssigned.length === 0) return null;
    const meetingConflict = sameMinuteAssigned.find((task) => includesMeetingSignal(task as Parameters<typeof includesMeetingSignal>[0]));
    if (meetingConflict) {
      return `NOTE: ${assigneeName} has a meeting at this time (${String(meetingConflict.title ?? "Untitled meeting")}).`;
    }
    return `NOTE: ${assigneeName} already has a task at this time (${String(sameMinuteAssigned[0]?.title ?? "another task")}).`;
  }, [assignedUserId, dueDate, existingTasks, members]);

  // ─── Initialization effects ──────────────────────────────────────────────

  useEffect(() => {
    if (prefillFromLastUsedProperty && open && !defaultPropertyId && lastUsedPropertyId && !propertyId) {
      setPropertyId(lastUsedPropertyId);
      setSelectedPropertyIds([lastUsedPropertyId]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillFromLastUsedProperty, open, defaultPropertyId, lastUsedPropertyId]);

  useEffect(() => {
    if (open && (defaultSpaceIds?.length || defaultAssetIds?.length)) {
      if (defaultSpaceIds?.length) setSelectedSpaceIds(defaultSpaceIds);
      if (defaultAssetIds?.length) setSelectedAssetIds(defaultAssetIds);
    }
  }, [open, defaultSpaceIds, defaultAssetIds]);

  useEffect(() => {
    if (open && prefill) {
      if (prefill.title != null) setTitle(prefill.title);
      if (prefill.description != null) setDescription(prefill.description);
      if (prefill.dueDate != null) setDueDate(prefill.dueDate);
      if (prefill.propertyId) {
        setPropertyId(prefill.propertyId);
        setSelectedPropertyIds([prefill.propertyId]);
      }
      if (prefill.spaceIds?.length) setSelectedSpaceIds(prefill.spaceIds);
      if (prefill.assetIds?.length) setSelectedAssetIds(prefill.assetIds);
    }
  }, [open, prefill]);

  useEffect(() => {
    if (!open) return;
    try {
      const stored = window.localStorage.getItem(recentStorageKey);
      if (!stored) { setRecentTemplateIds([]); return; }
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed)) {
        setRecentTemplateIds(
          (parsed as unknown[])
            .filter((id): id is string => typeof id === "string")
            .slice(0, 8)
        );
      } else {
        setRecentTemplateIds([]);
      }
    } catch {
      setRecentTemplateIds([]);
    }
  }, [open, recentStorageKey]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handlePropertyChange = useCallback((newPropertyIds: string[]) => {
    setSelectedPropertyIds(newPropertyIds);
    const primaryPropertyId = newPropertyIds.length > 0 ? newPropertyIds[0] : "";
    setPropertyId(primaryPropertyId);
    if (primaryPropertyId) setLastUsed(primaryPropertyId);
    if (newPropertyIds.length === 0) setSelectedSpaceIds([]);
  }, [setLastUsed]);

  const makeSubtaskFromText = useCallback((text: string): SubtaskInput => ({
    id: crypto.randomUUID(),
    title: text,
    is_yes_no: false,
    requires_signature: false,
  }), []);

  const normalizeChecklistItems = useCallback((items: SubtaskInput[]) => {
    return items
      .map((s) => ({ title: s.title.trim(), is_yes_no: Boolean(s.is_yes_no), requires_signature: Boolean(s.requires_signature) }))
      .filter((item) => item.title.length > 0);
  }, []);

  const rememberRecentTemplate = useCallback((id: string) => {
    setRecentTemplateIds((prev) => {
      const next = [id, ...prev.filter((item) => item !== id)].slice(0, 8);
      try { window.localStorage.setItem(recentStorageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [recentStorageKey]);

  const importTemplateItems = useCallback((tplId: string) => {
    const template = templates.find((t) => t.id === tplId);
    if (!template) {
      toast({ title: "Template not found", variant: "destructive" });
      return;
    }
    const rawItems = Array.isArray(template.items) ? template.items : [];
    const parsedSubtasks = rawItems
      .map((item): SubtaskInput | null => {
        if (typeof item === "string") {
          const t = item.trim();
          return t ? makeSubtaskFromText(t) : null;
        }
        if (item && typeof item === "object") {
          const c = item as { title?: string; label?: string; is_yes_no?: boolean; requires_signature?: boolean };
          const t = (c.title || c.label || "").trim();
          return t ? { id: crypto.randomUUID(), title: t, is_yes_no: Boolean(c.is_yes_no), requires_signature: Boolean(c.requires_signature) } : null;
        }
        return null;
      })
      .filter((item): item is SubtaskInput => Boolean(item));

    if (parsedSubtasks.length === 0) {
      toast({ title: "Template is empty", description: "No checklist items to import.", variant: "destructive" });
      return;
    }
    const hasExisting = subtasks.some((s) => s.title.trim().length > 0);
    if (hasExisting) {
      setPendingTemplateImport({ subtasks: parsedSubtasks, templateId: template.id, templateName: template.name });
      return;
    }
    setTemplateId(template.id);
    setSubtasks(parsedSubtasks);
    rememberRecentTemplate(template.id);
    toast({ title: "Checklist imported", description: `${parsedSubtasks.length} item${parsedSubtasks.length === 1 ? "" : "s"} loaded from "${template.name}".` });
  }, [makeSubtaskFromText, rememberRecentTemplate, subtasks, templates, toast]);

  const importStarterPreset = useCallback((preset: PresetTemplate) => {
    const parsedSubtasks = presetItemsToSubtasks(preset.items);
    if (parsedSubtasks.length === 0) {
      toast({ title: "Template is empty", description: "No checklist items to import.", variant: "destructive" });
      return;
    }
    const hasExisting = subtasks.some((s) => s.title.trim().length > 0);
    if (hasExisting) {
      setPendingTemplateImport({
        subtasks: parsedSubtasks,
        templateId: "",
        templateName: preset.name,
      });
      return;
    }
    setTemplateId("");
    setSubtasks(parsedSubtasks);
    toast({
      title: "Checklist imported",
      description: `${parsedSubtasks.length} item${parsedSubtasks.length === 1 ? "" : "s"} loaded from "${preset.name}".`,
    });
  }, [subtasks, toast]);

  const openTemplateDialog = useCallback((mode: ChecklistTemplateDialogMode) => {
    const items = normalizeChecklistItems(subtasks);
    if (items.length === 0) { toast({ title: "No checklist items", variant: "destructive" }); return; }
    if (mode === "edit" && !activeTemplate) { toast({ title: "No active template", variant: "destructive" }); return; }
    const baseName = title.trim() || description.trim().slice(0, 42) || `Checklist ${new Date().toLocaleDateString()}`;
    const defaultName = `${baseName.replace(/\s+/g, " ").trim()} Template`;
    if (mode === "edit" && activeTemplate) {
      setTemplateDraftName(activeTemplate.name);
      setTemplateDraftCategory(activeTemplate.category);
    } else if (mode === "duplicate" && activeTemplate) {
      setTemplateDraftName(`${activeTemplate.name} Copy`);
      setTemplateDraftCategory(activeTemplate.category);
    } else {
      setTemplateDraftName(defaultName);
      setTemplateDraftCategory("operations");
    }
    setTemplateDialogMode(mode);
  }, [activeTemplate, description, normalizeChecklistItems, subtasks, title, toast]);

  const submitTemplateDialog = useCallback(async () => {
    if (!orgId) { toast({ title: "Not signed in", variant: "destructive" }); return; }
    const items = normalizeChecklistItems(subtasks);
    if (items.length === 0) { toast({ title: "No checklist items", variant: "destructive" }); return; }
    const name = templateDraftName.trim();
    if (!name) { toast({ title: "Template name required", variant: "destructive" }); return; }

    if (templateDialogMode === "edit" && activeTemplate) {
      const { error } = await supabase.from("checklist_templates").update({ name, category: templateDraftCategory, items }).eq("id", activeTemplate.id).eq("org_id", orgId);
      if (error) { toast({ title: "Couldn't update template", description: error.message, variant: "destructive" }); return; }
      await refreshChecklistTemplates();
      setTemplateDialogMode(null);
      toast({ title: "Template updated", description: `"${name}" has been updated.` });
      return;
    }

    const { data, error } = await supabase.from("checklist_templates").insert({ org_id: orgId, name, category: templateDraftCategory, items }).select("id").single();
    if (error) { toast({ title: "Couldn't save template", description: error.message, variant: "destructive" }); return; }
    if (data) {
      setTemplateId(data.id);
      rememberRecentTemplate(data.id);
    }
    await refreshChecklistTemplates();
    setTemplateDialogMode(null);
    toast({ title: "Template saved", description: `"${name}" saved.` });
  }, [activeTemplate, normalizeChecklistItems, orgId, refreshChecklistTemplates, rememberRecentTemplate, subtasks, templateDialogMode, templateDraftCategory, templateDraftName, toast]);

  const archiveActiveTemplate = useCallback(async () => {
    if (!orgId || !activeTemplate) { toast({ title: "No active template", variant: "destructive" }); return; }
    setShowArchiveTemplateDialog(true);
  }, [activeTemplate, orgId, toast]);

  const confirmArchiveTemplate = useCallback(async () => {
    if (!orgId || !activeTemplate) return;
    const { error } = await supabase.from("checklist_templates").update({ is_archived: true }).eq("id", activeTemplate.id).eq("org_id", orgId);
    if (error) { toast({ title: "Couldn't archive template", description: error.message, variant: "destructive" }); return; }
    setTemplateId("");
    setShowArchiveTemplateDialog(false);
    await refreshChecklistTemplates();
    toast({ title: "Template archived", description: `"${activeTemplate.name}" has been archived.` });
  }, [activeTemplate, orgId, refreshChecklistTemplates, toast]);

  // ─── Reset ───────────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setPropertyId(defaultPropertyId || "");
    setSelectedPropertyIds(defaultPropertyId ? [defaultPropertyId] : []);
    setSelectedSpaceIds(defaultSpaceIds ?? []);
    setPriority("medium");
    setPriorityTouched(false);
    setDueDate(defaultDueDate || "");
    setRepeatRule(undefined);
    setMilestones([]);
    setAssignedUserId(undefined);
    setAssignedTeamIds([]);
    setPendingInvitations([]);
    setIsCompliance(false);
    setComplianceLevel("");
    setAnnotationRequired(false);
    setTemplateId("");
    setTemplateDialogMode(null);
    setTemplateDraftName("");
    setTemplateDraftCategory("operations");
    setSubtasks([]);
    setSelectedThemeIds([]);
    setSelectedAssetIds(defaultAssetIds ?? []);
    setImages([]);
    setTaskFiles([]);
    setShowAdvanced(false);
    setActiveSection(null);
    setInviteModalOpen(false);
    setInvitePrefill(null);
    setPendingTemplateImport(null);
    setShowArchiveTemplateDialog(false);
  }, [defaultPropertyId, defaultDueDate, defaultSpaceIds, defaultAssetIds]);

  // Auto-reset when modal closes
  useEffect(() => {
    if (!open) resetForm();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return {
    // External data
    orgId,
    members,
    refreshMembers,
    templates,
    refreshChecklistTemplates,
    spaces,
    teams,
    categories,
    activeTemplate,
    recentStorageKey,
    scheduleConflictNote,
    // Field state
    title, setTitle,
    description, setDescription,
    propertyId, setPropertyId,
    selectedPropertyIds, setSelectedPropertyIds,
    selectedSpaceIds, setSelectedSpaceIds,
    priority, setPriority,
    priorityTouched, setPriorityTouched,
    dueDate, setDueDate,
    repeatRule, setRepeatRule,
    milestones, setMilestones,
    assignedUserId, setAssignedUserId,
    assignedTeamIds, setAssignedTeamIds,
    pendingInvitations, setPendingInvitations,
    isCompliance, setIsCompliance,
    complianceLevel, setComplianceLevel,
    annotationRequired, setAnnotationRequired,
    templateId, setTemplateId,
    recentTemplateIds, setRecentTemplateIds,
    templateDialogMode, setTemplateDialogMode,
    templateDraftName, setTemplateDraftName,
    templateDraftCategory, setTemplateDraftCategory,
    subtasks, setSubtasks,
    selectedThemeIds, setSelectedThemeIds,
    selectedAssetIds, setSelectedAssetIds,
    images, setImages,
    taskFiles, setTaskFiles,
    showAdvanced, setShowAdvanced,
    activeSection, setActiveSection,
    inviteModalOpen, setInviteModalOpen,
    invitePrefill, setInvitePrefill,
    pendingTemplateImport, setPendingTemplateImport,
    showArchiveTemplateDialog, setShowArchiveTemplateDialog,
    // Handlers
    handlePropertyChange,
    makeSubtaskFromText,
    normalizeChecklistItems,
    rememberRecentTemplate,
    importTemplateItems,
    importStarterPreset,
    openTemplateDialog,
    submitTemplateDialog,
    archiveActiveTemplate,
    confirmArchiveTemplate,
    resetForm,
  };
}
