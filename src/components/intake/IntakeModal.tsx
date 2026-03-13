/**
 * IntakeModal — Universal intake composer for task / compliance / document.
 * Single entry point: upload → understand → act. AI suggestions inline; never overwrites user text.
 * Reuses existing task/compliance creation underneath.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useImageAnalysis } from "@/hooks/useImageAnalysis";
import { useIntakeAnalysis, type WorkflowHint } from "@/hooks/useIntakeAnalysis";
import { useChipSuggestions } from "@/hooks/useChipSuggestions";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useChecklistTemplates, type ChecklistTemplateCategory } from "@/hooks/useChecklistTemplates";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useSpaces } from "@/hooks/useSpaces";
import { useAIExtract } from "@/hooks/useAIExtract";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { SemanticChip } from "@/components/chips/semantic";
import { ImageUploadSection, type PendingTaskFile } from "@/components/tasks/create/ImageUploadSection";
import { IntakeChipRow, type IntakeChipRowChip, type IntakeChipSlotId } from "@/components/intake/IntakeChipRow";
import { SubtasksSection } from "@/components/tasks/create/SubtasksSection";
import type { SubtaskData } from "@/components/tasks/subtasks";
import { AddPropertyDialog } from "@/components/properties/AddPropertyDialog";
import { AddSpaceDialog } from "@/components/spaces/AddSpaceDialog";
import { CreateAssetDialog } from "@/components/assets/CreateAssetDialog";
import { InviteUserModal } from "@/components/invite/InviteUserModal";
import { getAssetIcon } from "@/lib/icon-resolver";
import type { SuggestedChip } from "@/types/chip-suggestions";
import type { TempImage } from "@/types/temp-image";
import { cleanupTempImage } from "@/utils/image-optimization";
import { format, addDays, startOfDay } from "date-fns";

const INTAKE_COMPLIANCE_TYPES = [
  "Fire Certificate",
  "Gas Safety Certificate",
  "Electrical Certificate",
  "EICR",
  "PAT Test",
  "Other",
];

const CHECKLIST_CATEGORY_OPTIONS: Array<{ value: ChecklistTemplateCategory; label: string }> = [
  { value: "compliance", label: "Compliance" },
  { value: "maintenance", label: "Maintenance" },
  { value: "security", label: "Security" },
  { value: "operations", label: "Operations" },
];

type ChecklistTemplateDialogMode = "save" | "edit" | "duplicate";

const TITLE_TRAILING_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "before",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const PAPER_TEXTURE_STYLE: React.CSSProperties = {
  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise-filter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.522\' numOctaves=\'1\' stitchTiles=\'stitch\'%3E%3C/feTurbulence%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'%3E%3C/feColorMatrix%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'0.468\'%3E%3C/feFuncR%3E%3CfeFuncG type=\'linear\' slope=\'0.468\'%3E%3C/feFuncG%3E%3CfeFuncB type=\'linear\' slope=\'0.468\'%3E%3C/feFuncB%3E%3CfeFuncA type=\'linear\' slope=\'0.137\'%3E%3C/feFuncA%3E%3C/feComponentTransfer%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncG type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncB type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise-filter)\' opacity=\'0.8\'%3E%3C/rect%3E%3C/svg%3E")',
  backgroundSize: "100%",
};

export interface IntakeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: (taskId: string) => void;
  defaultPropertyId?: string;
  variant?: "modal" | "column";
  headless?: boolean;
}

interface UploadedAttachment {
  id: string;
  fileUrl: string;
  fileName: string;
  isImage: boolean;
}

export function IntakeModal({
  open,
  onOpenChange,
  onTaskCreated,
  defaultPropertyId,
  variant = "modal",
  headless = false,
}: IntakeModalProps) {
  const { toast } = useToast();
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const { templates, refresh: refreshChecklistTemplates } = useChecklistTemplates(open);
  const { data: properties = [] } = usePropertiesQuery();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<TempImage[]>([]);
  const [taskFiles, setTaskFiles] = useState<PendingTaskFile[]>([]);
  const [userChoseWorkflow, setUserChoseWorkflow] = useState<WorkflowHint | null>(null);
  const [intakeComplianceType, setIntakeComplianceType] = useState("");
  const [intakeComplianceExpiry, setIntakeComplianceExpiry] = useState("");
  const [createReminderFromCompliance, setCreateReminderFromCompliance] = useState(false);
  const [openChipSlot, setOpenChipSlot] = useState<IntakeChipSlotId | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userEditedTitle, setUserEditedTitle] = useState(false);
  const [showTitleField, setShowTitleField] = useState(false);
  const [aiTitleGenerated, setAiTitleGenerated] = useState("");

  const { result: aiResult, loading: aiLoading } = useAIExtract(description);

  const isUsableGeneratedTitle = useCallback((rawTitle: string) => {
    const trimmed = rawTitle.trim().replace(/[.!?,:;]+$/, "");
    if (trimmed.length < 8) return false;

    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length < 3) return false;

    const lastWord = words[words.length - 1]?.toLowerCase() ?? "";
    if (TITLE_TRAILING_STOP_WORDS.has(lastWord)) return false;

    return true;
  }, []);

  useEffect(() => {
    if (!aiResult?.title?.trim() || userEditedTitle) return;
    const raw = aiResult.title.trim();
    if (!isUsableGeneratedTitle(raw)) return;
    const processed = raw.charAt(0).toUpperCase() + raw.slice(1).replace(/[.!]+$/, "");
    setAiTitleGenerated(processed);
    if (!title.trim()) setTitle(processed);
    setShowTitleField(true);
  }, [aiResult?.title, isUsableGeneratedTitle, userEditedTitle, title]);

  useEffect(() => {
    if (!description.trim()) {
      setShowTitleField(false);
      setUserEditedTitle(false);
      setTitle("");
      setAiTitleGenerated("");
    } else if (aiTitleGenerated && !userEditedTitle && !title.trim()) {
      setTitle(aiTitleGenerated);
      setShowTitleField(true);
    } else if (title.trim() && !showTitleField) {
      setShowTitleField(true);
    }
  }, [description, userEditedTitle, aiTitleGenerated, title, showTitleField]);

  const hasDescriptionDraft = Boolean(description.trim());
  const shouldShowTitleField = hasDescriptionDraft && (showTitleField || aiLoading || Boolean(title.trim()));

  // Chip row state (simplified: labels only for display; full IDs for submit)
  const [dueDate, setDueDate] = useState("");
  const [propertyId, setPropertyId] = useState(defaultPropertyId || "");
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [priorityDefined, setPriorityDefined] = useState(false);
  const [assignedUserId, setAssignedUserId] = useState<string | undefined>();
  const [subtasks, setSubtasks] = useState<SubtaskData[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [recentTemplateIds, setRecentTemplateIds] = useState<string[]>([]);
  const [templateDialogMode, setTemplateDialogMode] = useState<ChecklistTemplateDialogMode | null>(null);
  const [templateDraftName, setTemplateDraftName] = useState("");
  const [templateDraftCategory, setTemplateDraftCategory] = useState<ChecklistTemplateCategory>("operations");
  const [pendingTemplateImport, setPendingTemplateImport] = useState<{
    subtasks: SubtaskData[];
    templateId: string;
    templateName: string;
  } | null>(null);
  const [showArchiveTemplateDialog, setShowArchiveTemplateDialog] = useState(false);
  const [showAddPropertyDialog, setShowAddPropertyDialog] = useState(false);
  const [showAddSpaceDialog, setShowAddSpaceDialog] = useState(false);
  const [showCreateAssetDialog, setShowCreateAssetDialog] = useState(false);
  const [spaceDraftName, setSpaceDraftName] = useState("");
  const [assetDraftName, setAssetDraftName] = useState("");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [invitePrefill, setInvitePrefill] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
  } | null>(null);

  const handleAnalysisComplete = useCallback((localId: string, result: import("@/types/temp-image").ImageAnalysisResult) => {
    setImages((prev) =>
      prev.map((img) =>
        img.local_id === localId ? { ...img, rawAnalysis: result, aiOcrText: result.ocr_text, detectedLabels: result.detected_labels || [] } : img
      )
    );
  }, []);

  const { imageOcrText, detectedLabels } = useImageAnalysis({
    images,
    propertyId: propertyId || undefined,
    orgId: orgId ?? "",
    onAnalysisComplete: handleAnalysisComplete,
  });

  const detectedObjects = useMemo(
    () =>
      images.flatMap((img) =>
        (img.rawAnalysis?.detected_objects || []).map((o) => ({
          type: o.type,
          label: o.label,
          confidence: o.confidence,
          serial_number: o.serial_number,
          expiry_date: o.expiry_date,
        }))
      ),
    [images]
  );

  const { chips: chipSuggestions } = useChipSuggestions(
    {
      description,
      propertyId: propertyId || undefined,
      imageOcrText,
      detectedLabels,
      detectedObjects,
      selectedPersonId: assignedUserId,
    },
    { minDescriptionLength: 3 }
  );

  const { members } = useOrgMembers();
  const { spaces, refresh: refreshSpaces } = useSpaces(propertyId || undefined);
  const [availableAssets, setAvailableAssets] = useState<Array<{ id: string; name: string }>>([]);
  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templateId, templates]
  );
  const recentStorageKey = useMemo(
    () => `filla-checklist-recent:${orgId ?? "anon"}`,
    [orgId]
  );

  useEffect(() => {
    if (!open) return;
    try {
      const stored = window.localStorage.getItem(recentStorageKey);
      if (!stored) {
        setRecentTemplateIds([]);
        return;
      }
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setRecentTemplateIds(parsed.filter((id): id is string => typeof id === "string").slice(0, 8));
      } else {
        setRecentTemplateIds([]);
      }
    } catch {
      setRecentTemplateIds([]);
    }
  }, [open, recentStorageKey]);

  const rememberRecentTemplate = useCallback((id: string) => {
    setRecentTemplateIds((prev) => {
      const next = [id, ...prev.filter((item) => item !== id)].slice(0, 8);
      try {
        window.localStorage.setItem(recentStorageKey, JSON.stringify(next));
      } catch {
        // Ignore localStorage write failures.
      }
      return next;
    });
  }, [recentStorageKey]);

  const makeSubtaskFromText = useCallback((text: string): SubtaskData => ({
    id: crypto.randomUUID(),
    title: text,
    is_yes_no: false,
    requires_signature: false,
    step_type: "check",
  }), []);

  const normalizeChecklistItems = useCallback((items: SubtaskData[]) => {
    return items
      .map((subtask) => ({
        title: subtask.title.trim(),
        is_yes_no: Boolean(subtask.is_yes_no),
        requires_signature: Boolean(subtask.requires_signature),
      }))
      .filter((item) => item.title.length > 0);
  }, []);

  const importTemplateItems = useCallback((incomingTemplateId: string) => {
    const template = templates.find((item) => item.id === incomingTemplateId);
    if (!template) {
      toast({
        title: "Template not found",
        description: "That checklist template is no longer available.",
        variant: "destructive",
      });
      return;
    }

    const rawItems = Array.isArray(template.items) ? template.items : [];
    const parsedSubtasks = rawItems
      .map((item): SubtaskData | null => {
        if (typeof item === "string") {
          const title = item.trim();
          return title ? makeSubtaskFromText(title) : null;
        }
        if (item && typeof item === "object") {
          const candidate = item as {
            title?: string;
            label?: string;
            is_yes_no?: boolean;
            requires_signature?: boolean;
          };
          const title = (candidate.title || candidate.label || "").trim();
          if (!title) return null;
          return {
            id: crypto.randomUUID(),
            title,
            is_yes_no: Boolean(candidate.is_yes_no),
            requires_signature: Boolean(candidate.requires_signature),
            step_type: "check",
          };
        }
        return null;
      })
      .filter((item): item is SubtaskData => Boolean(item));

    if (parsedSubtasks.length === 0) {
      toast({
        title: "Template is empty",
        description: "This template has no checklist items to import.",
        variant: "destructive",
      });
      return;
    }

    const hasExistingSubtasks = subtasks.some((subtask) => subtask.title.trim().length > 0);
    if (hasExistingSubtasks) {
      setPendingTemplateImport({
        subtasks: parsedSubtasks,
        templateId: template.id,
        templateName: template.name,
      });
      return;
    }

    setTemplateId(template.id);
    setSubtasks(parsedSubtasks);
    rememberRecentTemplate(template.id);
    toast({
      title: "Checklist imported",
      description: `${parsedSubtasks.length} item${parsedSubtasks.length === 1 ? "" : "s"} loaded from "${template.name}".`,
    });
  }, [makeSubtaskFromText, rememberRecentTemplate, subtasks, templates, toast]);

  const openTemplateDialog = useCallback((mode: ChecklistTemplateDialogMode) => {
    const normalizedItems = normalizeChecklistItems(subtasks);
    if (normalizedItems.length === 0) {
      toast({
        title: "No checklist items",
        description: "Add at least one checklist item before managing templates.",
        variant: "destructive",
      });
      return;
    }

    if (mode === "edit" && !activeTemplate) {
      toast({
        title: "No active template",
        description: "Load a checklist template before editing.",
        variant: "destructive",
      });
      return;
    }

    const baseName =
      title.trim() ||
      description.trim().slice(0, 42) ||
      `Checklist ${new Date().toLocaleDateString()}`;
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
    if (!orgId) {
      toast({
        title: "Not signed in",
        description: "Log in to save checklist templates.",
        variant: "destructive",
      });
      return;
    }

    const normalizedItems = normalizeChecklistItems(subtasks);
    if (normalizedItems.length === 0) {
      toast({
        title: "No checklist items",
        description: "Add at least one checklist item before saving a template.",
        variant: "destructive",
      });
      return;
    }

    const trimmedName = templateDraftName.trim();
    if (!trimmedName) {
      toast({
        title: "Template name required",
        description: "Enter a checklist name before saving.",
        variant: "destructive",
      });
      return;
    }

    if (templateDialogMode === "edit" && activeTemplate) {
      const { error } = await supabase
        .from("checklist_templates")
        .update({
          name: trimmedName,
          category: templateDraftCategory,
          items: normalizedItems,
        })
        .eq("id", activeTemplate.id)
        .eq("org_id", orgId);

      if (error) {
        toast({
          title: "Couldn't update template",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      await refreshChecklistTemplates();
      setTemplateDialogMode(null);
      toast({
        title: "Template updated",
        description: `"${trimmedName}" has been updated.`,
      });
      return;
    }

    const { data, error } = await supabase
      .from("checklist_templates")
      .insert({
        org_id: orgId,
        name: trimmedName,
        category: templateDraftCategory,
        items: normalizedItems,
      })
      .select("id")
      .single();

    if (error) {
      toast({
        title: "Couldn't save template",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    await refreshChecklistTemplates();
    if (data?.id) {
      setTemplateId(data.id);
      rememberRecentTemplate(data.id);
    }
    setTemplateDialogMode(null);
    toast({
      title: "Template saved",
      description: `"${trimmedName}" is now available to import.`,
    });
  }, [
    activeTemplate,
    normalizeChecklistItems,
    orgId,
    refreshChecklistTemplates,
    rememberRecentTemplate,
    subtasks,
    templateDialogMode,
    templateDraftCategory,
    templateDraftName,
    toast,
  ]);

  const archiveActiveTemplate = useCallback(async () => {
    if (!orgId || !activeTemplate) {
      toast({
        title: "No active template",
        description: "Load a checklist template before archiving.",
        variant: "destructive",
      });
      return;
    }
    setShowArchiveTemplateDialog(true);
  }, [activeTemplate, orgId, toast]);

  const confirmArchiveTemplate = useCallback(async () => {
    if (!orgId || !activeTemplate) return;

    const { error } = await supabase
      .from("checklist_templates")
      .update({ is_archived: true })
      .eq("id", activeTemplate.id)
      .eq("org_id", orgId);

    if (error) {
      toast({
        title: "Couldn't archive template",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setTemplateId("");
    setShowArchiveTemplateDialog(false);
    await refreshChecklistTemplates();
    toast({
      title: "Template archived",
      description: `"${activeTemplate.name}" has been archived.`,
    });
  }, [activeTemplate, orgId, refreshChecklistTemplates, toast]);

  const loadAssets = useCallback(async () => {
    if (!orgId || !propertyId) {
      setAvailableAssets([]);
      return;
    }
    try {
      let query = supabase
        .from("assets")
        .select("id, name")
        .eq("org_id", orgId)
        .eq("property_id", propertyId);
      if (selectedSpaceIds[0]) {
        query = query.eq("space_id", selectedSpaceIds[0]);
      }
      const { data, error } = await query;
      if (error) throw error;
      setAvailableAssets((data || []).map((asset) => ({ id: asset.id, name: asset.name || "" })));
    } catch (error) {
      console.error("[IntakeModal] failed loading assets", error);
      setAvailableAssets([]);
    }
  }, [orgId, propertyId, selectedSpaceIds]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    const priorityChip = chipSuggestions.find((c) => c.type === "priority");
    if (!priorityChip?.label || priorityDefined) return;
    const raw = priorityChip.label.toLowerCase();
    if (raw.includes("urgent")) {
      setPriority("urgent");
      setPriorityDefined(true);
    } else if (raw.includes("high")) {
      setPriority("high");
      setPriorityDefined(true);
    } else if (raw.includes("low")) {
      setPriority("low");
      setPriorityDefined(true);
    } else if (raw.includes("normal") || raw.includes("medium")) {
      setPriority("medium");
      setPriorityDefined(true);
    }
  }, [chipSuggestions, priorityDefined]);

  // Auto-apply extracted date and person when we have resolved chips and field is still empty (so we don't overwrite user edits)
  useEffect(() => {
    const dateChip = chipSuggestions.find((c) => c.type === "date" && c.resolvedEntityId);
    if (!dueDate && dateChip?.resolvedEntityId && typeof dateChip.resolvedEntityId === "string") {
      const v = dateChip.resolvedEntityId;
      if (/^\d{4}-\d{2}-\d{2}/.test(v)) setDueDate(v.split("T")[0] || v);
    }
    const personChip = chipSuggestions.find((c) => (c.type === "person" || c.type === "team") && c.resolvedEntityId);
    if (!assignedUserId && personChip?.resolvedEntityId && typeof personChip.resolvedEntityId === "string") {
      setAssignedUserId(personChip.resolvedEntityId);
    }
  }, [chipSuggestions, dueDate, assignedUserId]);

  const analysis = useIntakeAnalysis({
    images,
    fileCount: taskFiles.length,
    composedText: description,
    userHasComposed: description.trim().length > 15,
  });

  const effectiveWorkflow: WorkflowHint =
    userChoseWorkflow ??
    (hasDescriptionDraft ? "task" : analysis.workflow_confidence >= 0.65 ? analysis.workflow_hint : "uncertain");
  const primaryIsTask = effectiveWorkflow === "task" || effectiveWorkflow === "uncertain";
  const primaryIsCompliance = effectiveWorkflow === "compliance";
  const primaryIsDocument = effectiveWorkflow === "document";

  useEffect(() => {
    if (primaryIsCompliance && analysis.document_type_hint && !intakeComplianceType) setIntakeComplianceType(analysis.document_type_hint);
    if (primaryIsCompliance && analysis.expiry_date_hint && !intakeComplianceExpiry) setIntakeComplianceExpiry(analysis.expiry_date_hint);
  }, [primaryIsCompliance, analysis.document_type_hint, analysis.expiry_date_hint, intakeComplianceType, intakeComplianceExpiry]);

  const selectedProperty = useMemo(
    () => properties.find((property: any) => property.id === propertyId) ?? null,
    [properties, propertyId]
  );
  const selectedSpaces = useMemo(
    () => selectedSpaceIds
      .map((id) => spaces.find((space) => space.id === id))
      .filter(Boolean) as Array<{ id: string; name: string; icon_name?: string }>,
    [selectedSpaceIds, spaces]
  );
  const selectedAssets = useMemo(
    () => selectedAssetIds
      .map((id) => availableAssets.find((asset) => asset.id === id))
      .filter(Boolean) as Array<{ id: string; name: string }>,
    [availableAssets, selectedAssetIds]
  );

  const splitName = useCallback((value: string) => {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) {
      return { firstName: parts[0] ?? value.trim(), lastName: "" };
    }
    return { firstName: parts.slice(0, -1).join(" "), lastName: parts.slice(-1).join("") };
  }, []);

  const formatDueDateLabel = useCallback((value: string) => {
    const dateValue = value.split("T")[0];
    const dateObj = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
    const today = startOfDay(new Date());
    if (dateObj.getTime() === today.getTime()) return "TODAY";
    if (dateObj.getTime() === addDays(today, 1).getTime()) return "TOMORROW";
    return format(dateObj, "EEE d MMM").toUpperCase();
  }, []);

  const chipShouldRenderAsFact = useCallback((chip: SuggestedChip) => {
    if (chip.type === "date") return false;
    return Boolean(chip.resolvedEntityId || !chip.blockingRequired);
  }, []);

  const formatSuggestionLabel = useCallback((chip: SuggestedChip) => {
    const raw = (chip.value || chip.label).toUpperCase();
    if (chip.type === "date") {
      const sourceValue =
        chip.resolvedEntityId && typeof chip.resolvedEntityId === "string"
          ? chip.resolvedEntityId
          : chip.label;
      return formatDueDateLabel(sourceValue);
    }
    if (chip.blockingRequired && !chip.resolvedEntityId) {
      switch (chip.type) {
        case "person":
          return `INVITE ${raw}`;
        case "team":
          return `CHOOSE ${raw}`;
        case "space":
        case "asset":
          return `ADD ${raw}`;
        case "category":
        case "theme":
          return `CHOOSE ${raw}`;
        default:
          return raw;
      }
    }
    return chip.label.toUpperCase();
  }, [formatDueDateLabel]);

  const rowSuggestionChip = useCallback(
    (...types: SuggestedChip["type"][]) => chipSuggestions.find((chip) => types.includes(chip.type)),
    [chipSuggestions]
  );

  const intakeRowChips: IntakeChipRowChip[] = useMemo(() => {
    const chips: IntakeChipRowChip[] = [];
    const whoSuggestion = rowSuggestionChip("person", "team");
    const whenSuggestion = rowSuggestionChip("date");
    const assetSuggestion = rowSuggestionChip("asset");
    const categorySuggestion = rowSuggestionChip("category", "theme");
    const locationSuggestion = rowSuggestionChip("space");
    const shouldPromptForProperty =
      hasDescriptionDraft &&
      chipSuggestions.length > 0 &&
      !selectedProperty &&
      !locationSuggestion;

    const assignedMember = members?.find((member) => member.user_id === assignedUserId);
    if (assignedMember?.display_name) {
      chips.push({
        id: `who-${assignedMember.user_id}`,
        slot: "who",
        label: assignedMember.display_name.toUpperCase(),
        epistemic: "fact",
      });
    } else if (whoSuggestion) {
      const inviteName = whoSuggestion.value || whoSuggestion.label;
      chips.push({
        id: whoSuggestion.id,
        slot: "who",
        label: formatSuggestionLabel(whoSuggestion),
        epistemic: chipShouldRenderAsFact(whoSuggestion) ? "fact" : "proposal",
        onPress: chipShouldRenderAsFact(whoSuggestion)
          ? undefined
          : () => {
              const parsed = splitName(inviteName);
              setInvitePrefill({
                firstName: parsed.firstName,
                lastName: parsed.lastName,
              });
              setInviteModalOpen(true);
            },
      });
    }

    if (selectedProperty) {
      chips.push({
        id: `where-property-${selectedProperty.id}`,
        slot: "where",
        label: (selectedProperty.nickname || selectedProperty.address || "Property").toUpperCase(),
        epistemic: "fact",
      });
    } else if (shouldPromptForProperty) {
      chips.push({
        id: "where-add-property",
        slot: "where",
        label: "ADD PROPERTY",
        epistemic: "proposal",
      });
    }

    selectedSpaces.forEach((space) => {
      chips.push({
        id: `where-space-${space.id}`,
        slot: "where",
        label: space.name.toUpperCase(),
        epistemic: "fact",
      });
    });

    selectedAssets.forEach((asset) => {
      chips.push({
        id: `asset-${asset.id}`,
        slot: "asset",
        label: asset.name.toUpperCase(),
        epistemic: "fact",
      });
    });

    if (dueDate) {
      chips.push({
        id: `when-${dueDate}`,
        slot: "when",
        label: formatDueDateLabel(dueDate),
        epistemic: "fact",
      });
    } else if (whenSuggestion) {
      chips.push({
        id: whenSuggestion.id,
        slot: "when",
        label: formatSuggestionLabel(whenSuggestion),
        epistemic: "proposal",
      });
    }

    if (assetSuggestion) {
      chips.push({
        id: assetSuggestion.id,
        slot: "asset",
        label: formatSuggestionLabel(assetSuggestion),
        epistemic: chipShouldRenderAsFact(assetSuggestion) ? "fact" : "proposal",
        onPress: () => {
          if (!propertyId) {
            setOpenChipSlot("where");
            return;
          }
          setAssetDraftName(assetSuggestion.value || assetSuggestion.label);
          setOpenChipSlot("asset");
        },
      });
    }

    if (priorityDefined) {
      chips.push({
        id: `priority-${priority}`,
        slot: "priority",
        label: (priority === "medium" ? "NORMAL" : priority.toUpperCase()),
        epistemic: "fact",
      });
    } else {
      const prioritySuggestion = rowSuggestionChip("priority");
      if (prioritySuggestion?.label) {
        chips.push({
          id: prioritySuggestion.id,
          slot: "priority",
          label: prioritySuggestion.label.toUpperCase(),
          epistemic: chipShouldRenderAsFact(prioritySuggestion) ? "fact" : "proposal",
        });
      }
    }

    if (categorySuggestion) {
      chips.push({
        id: categorySuggestion.id,
        slot: "category",
        label: formatSuggestionLabel(categorySuggestion),
        epistemic: chipShouldRenderAsFact(categorySuggestion) ? "fact" : "proposal",
      });
    }

    return chips;
  }, [
    assignedUserId,
    chipShouldRenderAsFact,
    dueDate,
    formatDueDateLabel,
    formatSuggestionLabel,
    hasDescriptionDraft,
    chipSuggestions.length,
    members,
    priority,
    priorityDefined,
    propertyId,
    rowSuggestionChip,
    selectedAssets,
    selectedProperty,
    selectedSpaces,
    splitName,
  ]);

  const toggleSpaceSelection = useCallback((spaceId: string) => {
    setSelectedSpaceIds((prev) =>
      prev.includes(spaceId) ? prev.filter((id) => id !== spaceId) : [...prev, spaceId]
    );
  }, []);

  const renderSlotContent = useCallback(
    (slot: IntakeChipSlotId, onClose: () => void) => {
      if (slot === "who") {
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Assign</p>
              {assignedUserId && (
                <button
                  type="button"
                  onClick={() => {
                    setAssignedUserId(undefined);
                    onClose();
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {members.slice(0, 8).map((member) => (
                <SemanticChip
                  key={member.user_id}
                  epistemic={assignedUserId === member.user_id ? "fact" : "proposal"}
                  label={(member.display_name || member.email || "Member").toUpperCase()}
                  onPress={() => {
                    setAssignedUserId(member.user_id);
                    onClose();
                  }}
                />
              ))}
            </div>
          </div>
        );
      }

      if (slot === "where") {
        const unresolvedSpaceSuggestions = chipSuggestions.filter(
          (chip) =>
            chip.type === "space" &&
            chip.blockingRequired &&
            !chip.resolvedEntityId &&
            !selectedSpaces.some((space) => space.name.toLowerCase() === chip.label.toLowerCase())
        );

        return (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Location</p>
              <div className="flex flex-wrap gap-2">
                {selectedProperty && (
                  <SemanticChip
                    epistemic="fact"
                    label={(selectedProperty.nickname || selectedProperty.address || "Property").toUpperCase()}
                    onPress={() => onClose()}
                  />
                )}
                {properties.slice(0, 6).map((property: any) => {
                  if (selectedProperty?.id === property.id) return null;
                  const Icon = getAssetIcon(property.icon_name || "building");
                  return (
                    <SemanticChip
                      key={property.id}
                      epistemic="proposal"
                      label={(property.nickname || property.address || "Property").toUpperCase()}
                      icon={<Icon className="h-3.5 w-3.5" />}
                      onPress={() => {
                        setPropertyId(property.id);
                        setSelectedSpaceIds([]);
                      }}
                    />
                  );
                })}
                <SemanticChip
                  epistemic="proposal"
                  label="+ PROPERTY"
                  onPress={() => setShowAddPropertyDialog(true)}
                />
                <SemanticChip
                  epistemic="proposal"
                  label="+ SPACE"
                  onPress={() => {
                    if (!propertyId) {
                      toast({
                        title: "Choose a property first",
                        description: "Pick a property before adding a space.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setSpaceDraftName("");
                    setShowAddSpaceDialog(true);
                  }}
                />
              </div>
            </div>

            {propertyId && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Spaces</p>
                <div className="flex flex-wrap gap-2">
                  {spaces.map((space) => {
                    const Icon = getAssetIcon((space as { icon_name?: string }).icon_name);
                    const selected = selectedSpaceIds.includes(space.id);
                    return (
                      <SemanticChip
                        key={space.id}
                        epistemic={selected ? "fact" : "proposal"}
                        label={space.name.toUpperCase()}
                        icon={<Icon className="h-3.5 w-3.5" />}
                        onPress={() => toggleSpaceSelection(space.id)}
                      />
                    );
                  })}
                  {unresolvedSpaceSuggestions.map((chip) => (
                    <SemanticChip
                      key={chip.id}
                      epistemic="proposal"
                      label={`ADD ${chip.label.toUpperCase()}`}
                      onPress={() => {
                        setSpaceDraftName(chip.label);
                        setShowAddSpaceDialog(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }

      if (slot === "when") {
        const today = startOfDay(new Date());
        const quick = [
          { label: "Today", date: format(today, "yyyy-MM-dd") },
          { label: "Tomorrow", date: format(addDays(today, 1), "yyyy-MM-dd") },
          { label: "+7D", date: format(addDays(today, 7), "yyyy-MM-dd") },
          { label: "+14D", date: format(addDays(today, 14), "yyyy-MM-dd") },
        ];
        return (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Due date</p>
            <div className="flex flex-wrap gap-1.5">
              {quick.map(({ label, date }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setDueDate(date);
                    onClose();
                  }}
                  className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-muted/60 hover:bg-muted"
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full mt-1 h-8 rounded border border-input bg-input px-2 text-xs"
            />
          </div>
        );
      }

      if (slot === "asset") {
        const unresolvedAssetSuggestions = chipSuggestions.filter(
          (chip) =>
            chip.type === "asset" &&
            chip.blockingRequired &&
            !chip.resolvedEntityId &&
            !selectedAssets.some((asset) => asset.name.toLowerCase() === (chip.value || chip.label).toLowerCase())
        );

        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Assets</p>
              <button
                type="button"
                onClick={() => {
                  if (!propertyId) {
                    setOpenChipSlot("where");
                    return;
                  }
                  setAssetDraftName("");
                  setShowCreateAssetDialog(true);
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                + Asset
              </button>
            </div>
            {!propertyId ? (
              <p className="text-xs text-muted-foreground py-1">
                Pick a property first, then you can add or select assets.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableAssets.map((asset) => (
                  <SemanticChip
                    key={asset.id}
                    epistemic={selectedAssetIds.includes(asset.id) ? "fact" : "proposal"}
                    label={asset.name.toUpperCase()}
                    onPress={() => {
                      setSelectedAssetIds((prev) =>
                        prev.includes(asset.id) ? prev.filter((id) => id !== asset.id) : [...prev, asset.id]
                      );
                    }}
                  />
                ))}
                {unresolvedAssetSuggestions.map((chip) => (
                  <SemanticChip
                    key={chip.id}
                    epistemic="proposal"
                    label={`ADD ${(chip.value || chip.label).toUpperCase()}`}
                    onPress={() => {
                      setAssetDraftName(chip.value || chip.label);
                      setShowCreateAssetDialog(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      }

      if (slot === "priority") {
        return (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Priority</p>
            {(["low", "medium", "high", "urgent"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPriority(p);
                  setPriorityDefined(true);
                  onClose();
                }}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded text-xs",
                  priority === p ? "bg-primary/20 text-foreground" : "hover:bg-muted/60"
                )}
              >
                {p === "medium" ? "Normal" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        );
      }

      return (
        <p className="text-xs text-muted-foreground py-1">
          {slot} — use full Create Task for full options.
        </p>
      );
    },
    [
      assignedUserId,
      chipSuggestions,
      dueDate,
      members,
      priority,
      properties,
      propertyId,
      availableAssets,
      selectedProperty,
      selectedAssets,
      selectedAssetIds,
      selectedSpaceIds,
      selectedSpaces,
      spaces,
      toast,
      toggleSpaceSelection,
    ]
  );

  const uploadIntakeAttachments = useCallback(
    async (params: {
      parentType: string;
      parentId: string;
      mode: "task" | "compliance" | "document";
      taskId?: string;
      complianceDocumentId?: string;
    }): Promise<UploadedAttachment[]> => {
      if (!orgId) return [];
      const { parentType, parentId, mode, taskId, complianceDocumentId } = params;
      const uploaded: UploadedAttachment[] = [];

      for (const tempImage of images) {
        try {
          const imageUuid = crypto.randomUUID();
          const basePath = `org/${orgId}/${parentType}/${parentId}/images/${imageUuid}`;
          const thumbnailPath = `${basePath}/thumb.webp`;
          const optimizedPath = `${basePath}/optimized.webp`;

          const { error: thumbError } = await supabase.storage
            .from("task-images")
            .upload(thumbnailPath, tempImage.thumbnail_blob, {
              contentType: tempImage.thumbnail_blob.type || "image/webp",
              cacheControl: "31536000",
            });
          if (thumbError) throw thumbError;

          const { error: optError } = await supabase.storage
            .from("task-images")
            .upload(optimizedPath, tempImage.optimized_blob, {
              contentType: tempImage.optimized_blob.type || "image/webp",
              cacheControl: "31536000",
            });
          if (optError) throw optError;

          const { data: thumbUrl } = supabase.storage.from("task-images").getPublicUrl(thumbnailPath);
          const { data: optUrl } = supabase.storage.from("task-images").getPublicUrl(optimizedPath);

          const { data: attachment, error: attachError } = await supabase
            .from("attachments")
            .insert({
              org_id: orgId,
              parent_type: parentType,
              parent_id: parentId,
              file_url: optUrl.publicUrl,
              thumbnail_url: thumbUrl.publicUrl,
              optimized_url: optUrl.publicUrl,
              file_name: tempImage.display_name,
              file_type: tempImage.optimized_blob.type || "image/webp",
              file_size: tempImage.optimized_blob.size,
              annotation_json: tempImage.annotation_json || [],
              upload_status: "complete",
            })
            .select("id,file_url,file_name")
            .single();

          if (attachError || !attachment?.id) throw attachError ?? new Error("Attachment insert failed");

          uploaded.push({
            id: attachment.id,
            fileUrl: attachment.file_url,
            fileName: attachment.file_name || tempImage.display_name,
            isImage: true,
          });

          if (mode === "task") {
            void supabase.functions.invoke("ai-image-analyse", {
              body: {
                attachment_id: attachment.id,
                file_url: attachment.file_url,
                org_id: orgId,
                property_id: propertyId || null,
                task_id: taskId || null,
              },
            });
          } else {
            void supabase.functions.invoke("ai-doc-analyse", {
              body: {
                attachment_id: attachment.id,
                file_url: attachment.file_url,
                file_name: attachment.file_name || tempImage.display_name,
                org_id: orgId,
                property_id: propertyId || null,
                compliance_document_id: complianceDocumentId || null,
              },
            });
          }
        } catch (error) {
          console.error("[IntakeModal] image upload failed:", error);
          toast({
            title: "Image upload failed",
            description: `Couldn't upload "${tempImage.display_name}".`,
            variant: "destructive",
          });
        }
      }

      for (const pendingFile of taskFiles) {
        try {
          const ext = pendingFile.display_name.split(".").pop() || "bin";
          const filePath = `org/${orgId}/${parentType}/${parentId}/files/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("task-images")
            .upload(filePath, pendingFile.file, {
              cacheControl: "31536000",
            });
          if (uploadError) throw uploadError;

          const { data: fileUrl } = supabase.storage.from("task-images").getPublicUrl(filePath);
          const { data: attachment, error: attachmentError } = await supabase
            .from("attachments")
            .insert({
              org_id: orgId,
              parent_type: parentType,
              parent_id: parentId,
              file_url: fileUrl.publicUrl,
              file_name: pendingFile.display_name,
              file_type: pendingFile.file_type,
              file_size: pendingFile.file_size,
              upload_status: "complete",
            })
            .select("id,file_url,file_name")
            .single();
          if (attachmentError || !attachment?.id) throw attachmentError ?? new Error("Attachment insert failed");

          uploaded.push({
            id: attachment.id,
            fileUrl: attachment.file_url,
            fileName: attachment.file_name || pendingFile.display_name,
            isImage: false,
          });

          if (mode !== "task") {
            void supabase.functions.invoke("ai-doc-analyse", {
              body: {
                attachment_id: attachment.id,
                file_url: attachment.file_url,
                file_name: attachment.file_name || pendingFile.display_name,
                org_id: orgId,
                property_id: propertyId || null,
                compliance_document_id: complianceDocumentId || null,
              },
            });
          }
        } catch (error) {
          console.error("[IntakeModal] file upload failed:", error);
          toast({
            title: "File upload failed",
            description: `Couldn't upload "${pendingFile.display_name}".`,
            variant: "destructive",
          });
        }
      }

      return uploaded;
    },
    [images, taskFiles, orgId, propertyId, toast]
  );

  const handleSubmit = async () => {
    if (!orgId) {
      toast({ title: "Not signed in", variant: "destructive" });
      return;
    }

    if (primaryIsCompliance) {
      const complianceTitle = title.trim() || description.trim().slice(0, 80) || "Compliance document";
      setIsSubmitting(true);
      try {
        const { data, error } = await supabase.functions.invoke("ai-actions-create-compliance", {
          body: {
            org_id: orgId,
            property_id: propertyId || null,
            title: complianceTitle,
            compliance_type: intakeComplianceType.trim() || null,
            expiry_date: intakeComplianceExpiry.trim() || null,
            attachment_id: null,
          },
        });
        if (error) throw error;
        if (!data?.id) throw new Error("No compliance record returned");

        const uploaded = await uploadIntakeAttachments({
          parentType: "compliance",
          parentId: data.id,
          mode: "compliance",
          complianceDocumentId: data.id,
        });

        if (uploaded.length > 0) {
          const links = uploaded.map((a) => ({
            attachment_id: a.id,
            compliance_document_id: data.id,
            org_id: orgId,
          }));
          const { error: linkError } = await supabase.from("attachment_compliance").insert(links);
          if (linkError) throw linkError;
        }

        queryClient.invalidateQueries({ queryKey: ["compliance"] });
        queryClient.invalidateQueries({ queryKey: ["compliance_recommendations"] });
        queryClient.invalidateQueries({ queryKey: ["property_documents"] });
        toast({ title: "Added to Compliance" });
        onOpenChange(false);
        resetForm();
      } catch (err: unknown) {
        toast({
          title: "Could not add to Compliance",
          description: err instanceof Error ? err.message : "Something went wrong",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (primaryIsDocument) {
      if (!propertyId) {
        toast({
          title: "Select a location",
          description: "Choose a property before saving documents.",
          variant: "destructive",
        });
        return;
      }
      setIsSubmitting(true);
      try {
        await uploadIntakeAttachments({
          parentType: "property",
          parentId: propertyId,
          mode: "document",
        });
        queryClient.invalidateQueries({ queryKey: ["property_documents"] });
        toast({ title: "Document saved" });
        onOpenChange(false);
        resetForm();
      } catch (err: unknown) {
        toast({
          title: "Could not save document",
          description: err instanceof Error ? err.message : "Something went wrong",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const finalTitle = title.trim() || aiTitleGenerated.trim() || description.trim().slice(0, 50) || "New task";
    if (!finalTitle) {
      toast({ title: "Add a title or note", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      let dueDateValue: string | null = null;
      if (dueDate) dueDateValue = new Date(dueDate).toISOString();

      const { data: newTask, error } = await supabase
        .from("tasks")
        .insert({
          org_id: orgId,
          title: finalTitle,
          description: description.trim() || null,
          property_id: propertyId || null,
          due_date: dueDateValue,
          priority: priority === "medium" ? "normal" : priority,
          assigned_user_id: assignedUserId || null,
          status: "open",
        })
        .select("id")
        .single();

      if (error) throw error;
      if (!newTask?.id) throw new Error("No task id returned");

      const normalizedSubtasks = subtasks
        .map((step, index) => ({
          task_id: newTask.id,
          org_id: orgId,
          title: step.title.trim(),
          is_yes_no: Boolean(step.is_yes_no),
          requires_signature: Boolean(step.requires_signature),
          order_index: index,
          is_completed: false,
          completed: false,
        }))
        .filter((step) => step.title.length > 0);

      if (normalizedSubtasks.length > 0) {
        const { error: subtaskError } = await supabase.from("subtasks").insert(normalizedSubtasks);
        if (subtaskError) throw subtaskError;
      }

      if (selectedSpaceIds.length > 0) {
        const { error: taskSpacesError } = await supabase
          .from("task_spaces")
          .insert(selectedSpaceIds.map((spaceId) => ({ task_id: newTask.id, space_id: spaceId })));
        if (taskSpacesError) {
          console.error("Error linking spaces to task:", taskSpacesError);
        }
      }

      if (selectedAssetIds.length > 0) {
        const { error: taskAssetsError } = await supabase
          .from("task_assets")
          .insert(selectedAssetIds.map((assetId) => ({ task_id: newTask.id, asset_id: assetId })));
        if (taskAssetsError) {
          console.error("Error linking assets to task:", taskAssetsError);
        }
      }

      await uploadIntakeAttachments({
        parentType: "task",
        parentId: newTask.id,
        mode: "task",
        taskId: newTask.id,
      });

      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks-briefing"] });
      queryClient.invalidateQueries({ queryKey: ["task-attachments", newTask.id] });
      toast({ title: "Task created" });
      onTaskCreated?.(newTask.id);
      onOpenChange(false);
      resetForm();
    } catch (err: unknown) {
      toast({
        title: "Could not create task",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setUserEditedTitle(false);
    setShowTitleField(false);
    setAiTitleGenerated("");
    setImages((prev) => {
      prev.forEach(cleanupTempImage);
      return [];
    });
    setTaskFiles([]);
    setUserChoseWorkflow(null);
    setIntakeComplianceType("");
    setIntakeComplianceExpiry("");
    setCreateReminderFromCompliance(false);
    setOpenChipSlot(null);
    setDueDate("");
    setPropertyId(defaultPropertyId || "");
    setSelectedSpaceIds([]);
    setSelectedAssetIds([]);
    setPriority("medium");
    setPriorityDefined(false);
    setAssignedUserId(undefined);
    setSubtasks([]);
    setTemplateId("");
    setRecentTemplateIds([]);
    setTemplateDialogMode(null);
    setTemplateDraftName("");
    setTemplateDraftCategory("operations");
    setPendingTemplateImport(null);
    setShowArchiveTemplateDialog(false);
    setShowAddPropertyDialog(false);
    setShowAddSpaceDialog(false);
    setShowCreateAssetDialog(false);
    setSpaceDraftName("");
    setAssetDraftName("");
    setInviteModalOpen(false);
    setInvitePrefill(null);
  }, [defaultPropertyId]);

  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  const primaryLabel = primaryIsCompliance
    ? "Add to Compliance"
    : primaryIsDocument
      ? "Save Document"
      : "Create Task";
  const secondaryLabel =
    primaryIsCompliance
      ? "Create task instead"
      : primaryIsDocument
        ? "Create task instead"
        : "Add to Compliance instead";

  const renderTemplateDialog = () => {
    const isOpen = templateDialogMode !== null;
    const title =
      templateDialogMode === "edit"
        ? "Edit Checklist Template"
        : templateDialogMode === "duplicate"
          ? "Duplicate Checklist Template"
          : "Save Checklist Template";
    const cta = templateDialogMode === "edit" ? "Update Template" : "Save Template";

    return (
      <Dialog open={isOpen} onOpenChange={(openState) => !openState && setTemplateDialogMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Save checklist templates for quick reuse in the unified task composer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Template name</Label>
              <input
                value={templateDraftName}
                onChange={(event) => setTemplateDraftName(event.target.value)}
                placeholder="e.g. Fire Safety Check"
                className="w-full h-9 px-3 rounded-[10px] bg-input shadow-engraved text-sm text-foreground placeholder:text-muted-foreground/60 border-0 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Category</Label>
              <Select
                value={templateDraftCategory}
                onValueChange={(value) => setTemplateDraftCategory(value as ChecklistTemplateCategory)}
              >
                <SelectTrigger className="h-9 shadow-engraved">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHECKLIST_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setTemplateDialogMode(null)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={submitTemplateDialog}>
                {cta}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const renderAlertDialogs = () => (
    <>
      <AlertDialog open={!!pendingTemplateImport} onOpenChange={(openState) => !openState && setPendingTemplateImport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing checklist?</AlertDialogTitle>
            <AlertDialogDescription>
              You already have checklist items. Do you want to replace them with "{pendingTemplateImport?.templateName}", or add the new items to the end?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setPendingTemplateImport(null)}>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              className="shadow-e1"
              onClick={() => {
                if (!pendingTemplateImport) return;
                setTemplateId(pendingTemplateImport.templateId);
                setSubtasks((prev) => [...prev, ...pendingTemplateImport.subtasks]);
                rememberRecentTemplate(pendingTemplateImport.templateId);
                toast({
                  title: "Checklist appended",
                  description: `${pendingTemplateImport.subtasks.length} item${pendingTemplateImport.subtasks.length === 1 ? "" : "s"} added from "${pendingTemplateImport.templateName}".`,
                });
                setPendingTemplateImport(null);
              }}
            >
              Append
            </Button>
            <AlertDialogAction
              onClick={() => {
                if (!pendingTemplateImport) return;
                setTemplateId(pendingTemplateImport.templateId);
                setSubtasks(pendingTemplateImport.subtasks);
                rememberRecentTemplate(pendingTemplateImport.templateId);
                toast({
                  title: "Checklist imported",
                  description: `${pendingTemplateImport.subtasks.length} item${pendingTemplateImport.subtasks.length === 1 ? "" : "s"} loaded from "${pendingTemplateImport.templateName}".`,
                });
                setPendingTemplateImport(null);
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showArchiveTemplateDialog} onOpenChange={setShowArchiveTemplateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive template?</AlertDialogTitle>
            <AlertDialogDescription>
              "{activeTemplate?.name}" will be removed from the checklist picker. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmArchiveTemplate}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  const content = (
    <>
      {variant !== "column" && (
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-border/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Add item</DialogTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {/* 1. Upload */}
          <ImageUploadSection
            images={images}
            onImagesChange={setImages}
            files={taskFiles}
            onFilesChange={setTaskFiles}
            taskId={undefined}
          />

          {/* 2. Composer: title (hidden until description; AI-generated) + main text */}
          <div className="space-y-2">
            {shouldShowTitleField && (
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setUserEditedTitle(true);
                  setTitle(e.target.value);
                  if (!e.target.value.trim()) setUserEditedTitle(false);
                }}
                placeholder="Generated title…"
                className="w-full h-9 px-3 rounded-lg bg-input shadow-engraved text-sm border-0 focus:ring-2 focus:ring-primary/30"
              />
            )}
            <div className="rounded-lg bg-input shadow-engraved overflow-hidden">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What needs doing? Or add a note…"
                rows={3}
                className="w-full px-3 py-2 text-sm border-0 bg-transparent shadow-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 resize-none"
              />
              {hasDescriptionDraft && (
                <div>
                  <SubtasksSection
                    subtasks={subtasks}
                    onSubtasksChange={setSubtasks}
                    showDescription={false}
                    embedded
                    description=""
                    onDescriptionChange={() => {}}
                    className="bg-transparent"
                    templates={templates}
                    recentTemplateIds={recentTemplateIds}
                    activeTemplateName={activeTemplate?.name ?? null}
                    onUseTemplate={importTemplateItems}
                    onSaveAsTemplate={() => openTemplateDialog("save")}
                    onEditTemplate={() => openTemplateDialog("edit")}
                    onDuplicateTemplate={() => openTemplateDialog("duplicate")}
                    onArchiveTemplate={archiveActiveTemplate}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 3. Compliance inline fields when path is compliance */}
          {primaryIsCompliance && (
            <div className="rounded-lg bg-muted/40 p-3 space-y-2 border border-border/50 shadow-e1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Compliance</p>
              <div className="grid gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Document type</Label>
                  <select
                    value={intakeComplianceType}
                    onChange={(e) => setIntakeComplianceType(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-input bg-input px-2 text-sm"
                  >
                    <option value="">Select</option>
                    {INTAKE_COMPLIANCE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Expiry / renewal</Label>
                  <input
                    type="date"
                    value={intakeComplianceExpiry}
                    onChange={(e) => setIntakeComplianceExpiry(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-input bg-input px-2 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createReminderFromCompliance}
                    onChange={(e) => setCreateReminderFromCompliance(e.target.checked)}
                    className="rounded border-input"
                  />
                  Create reminder task
                </label>
              </div>
            </div>
          )}

          {/* 4. Context chip row */}
          <IntakeChipRow
            chips={intakeRowChips}
            onOpenSlot={setOpenChipSlot}
            openSlot={openChipSlot}
            onCloseSlot={() => setOpenChipSlot(null)}
            renderSlotContent={renderSlotContent}
          />

      </div>

      {/* 6. Footer: one adaptive primary + secondary override */}
      <div className="px-4 py-3 border-t border-border/30 space-y-2">
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 shadow-e1" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button className="flex-1 shadow-primary-btn" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : primaryLabel}
          </Button>
        </div>
        {analysis.workflow_confidence >= 0.5 && (
          <div className="text-center">
            <button
              type="button"
              onClick={() =>
                setUserChoseWorkflow(
                  primaryIsCompliance ? "task" : primaryIsDocument ? "task" : "compliance"
                )
              }
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              {secondaryLabel}
            </button>
          </div>
        )}
      </div>
      {renderTemplateDialog()}
      {renderAlertDialogs()}
      <AddPropertyDialog
        open={showAddPropertyDialog}
        onOpenChange={setShowAddPropertyDialog}
        onCreated={(property) => {
          setPropertyId(property.id);
          setSelectedSpaceIds([]);
          setShowAddPropertyDialog(false);
        }}
      />
      <AddSpaceDialog
        open={showAddSpaceDialog}
        onOpenChange={setShowAddSpaceDialog}
        properties={properties}
        propertyId={propertyId || undefined}
        initialName={spaceDraftName}
        onCreated={(space) => {
          setSelectedSpaceIds((prev) => (prev.includes(space.id) ? prev : [...prev, space.id]));
          setSpaceDraftName("");
          setShowAddSpaceDialog(false);
          refreshSpaces();
        }}
      />
      <CreateAssetDialog
        open={showCreateAssetDialog}
        onOpenChange={setShowCreateAssetDialog}
        propertyId={propertyId || ""}
        spaceId={selectedSpaceIds[0]}
        defaultName={assetDraftName}
        onAssetCreated={(assetId) => {
          setSelectedAssetIds((prev) => (prev.includes(assetId) ? prev : [...prev, assetId]));
          setAssetDraftName("");
          setShowCreateAssetDialog(false);
          void loadAssets();
        }}
      />
      <InviteUserModal
        open={inviteModalOpen}
        onOpenChange={(openState) => {
          setInviteModalOpen(openState);
          if (!openState) setInvitePrefill(null);
        }}
        prefillFirstName={invitePrefill?.firstName ?? ""}
        prefillLastName={invitePrefill?.lastName ?? ""}
        prefillEmail={invitePrefill?.email ?? ""}
        onInviteSent={(invitation) => {
          if (invitation.status === "accepted" && invitation.userId) {
            setAssignedUserId(invitation.userId);
          }
          setInvitePrefill(null);
        }}
      />
    </>
  );

  if (variant === "column" && headless) {
    return (
      <div
        className={cn(
          "flex flex-col h-full min-h-0 p-0 gap-0 rounded-xl border-0",
          "shadow-[3px_5px_8px_rgba(174,174,178,0.25),-3px_-3px_6px_rgba(255,255,255,0.7)]"
        )}
        style={{
          ...PAPER_TEXTURE_STYLE,
          backgroundColor: "hsl(var(--background))",
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-lg max-h-[90vh] flex flex-col p-0 gap-0",
          "rounded-xl border-0 shadow-[3px_5px_8px_rgba(174,174,178,0.25),-3px_-3px_6px_rgba(255,255,255,0.7)]"
        )}
        style={{
          ...PAPER_TEXTURE_STYLE,
          backgroundColor: "hsl(var(--background))",
        }}
      >
        {content}
      </DialogContent>
    </Dialog>
  );
}
