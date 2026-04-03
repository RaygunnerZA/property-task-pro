/**
 * IntakeModal — Universal intake composer for task / compliance / document.
 * Single entry point: upload → understand → act. AI suggestions inline; never overwrites user text.
 * Reuses existing task/compliance creation underneath.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import {
  IntakeChipRow,
  type IntakeChipRowChip,
  type IntakeChipSlotId,
  type IntakeSlotPanelRows,
} from "@/components/intake/IntakeChipRow";
import { SubtasksSection } from "@/components/tasks/create/SubtasksSection";
import type { SubtaskData } from "@/components/tasks/subtasks";
import { AddPropertyDialog } from "@/components/properties/AddPropertyDialog";
import { AddSpaceDialog } from "@/components/spaces/AddSpaceDialog";
import { CreateAssetDialog } from "@/components/assets/CreateAssetDialog";
import { InviteUserModal } from "@/components/invite/InviteUserModal";
import { getAssetIcon } from "@/lib/icon-resolver";
import type { TempImage } from "@/types/temp-image";
import { cleanupTempImage } from "@/utils/image-optimization";
import { format, addDays, addMonths, startOfDay } from "date-fns";
import { Calendar as MiniCalendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { useCategories } from "@/hooks/useCategories";
import { useWhoSuggestions, type WhoProposal } from "@/hooks/useWhoSuggestions";
import { useTeams } from "@/hooks/useTeams";

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

function buildFallbackTitleFromDescription(input: string): string {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const needToMatch = normalized.match(/\b(?:we\s+need\s+to|need\s+to)\s+([^,.!?]+)/i);
  if (needToMatch?.[1]) {
    const action = needToMatch[1].trim().replace(/[.!?,:;]+$/, "");
    if (action.length >= 6) {
      return action.charAt(0).toUpperCase() + action.slice(1);
    }
  }

  const firstClause = normalized.split(/[,.!?]/)[0]?.trim() || normalized;
  const words = firstClause.split(" ").filter(Boolean).slice(0, 8);
  if (words.length === 0) return "";
  const title = words.join(" ").replace(/[.!?,:;]+$/, "");
  return title.charAt(0).toUpperCase() + title.slice(1);
}

const PAPER_TEXTURE_STYLE: React.CSSProperties = {
  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise-filter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.522\' numOctaves=\'1\' stitchTiles=\'stitch\'%3E%3C/feTurbulence%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'%3E%3C/feColorMatrix%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'0.468\'%3E%3C/feFuncR%3E%3CfeFuncG type=\'linear\' slope=\'0.468\'%3E%3C/feFuncG%3E%3CfeFuncB type=\'linear\' slope=\'0.468\'%3E%3C/feFuncB%3E%3CfeFuncA type=\'linear\' slope=\'0.137\'%3E%3C/feFuncA%3E%3C/feComponentTransfer%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncG type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncB type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise-filter)\' opacity=\'0.8\'%3E%3C/rect%3E%3C/svg%3E")',
  backgroundSize: "100%",
};

/** Matches Create Task rows (CategorySection, WhereSection, WhoSection) — chip becomes this input. */
const INTAKE_INLINE_INPUT_CLASS = cn(
  "h-[28px] min-w-[100px] max-w-[240px] rounded-[8px] px-2 py-1 shrink-0 flex-shrink-0",
  "font-mono text-[11px] uppercase tracking-wide",
  "bg-background text-muted-foreground/70 placeholder:text-muted-foreground/50",
  "shadow-inset outline-none cursor-text",
  "transition-[width] duration-150 ease-out"
);
const INTAKE_INPUT_CH = 8;
const INTAKE_INPUT_MIN = 100;
const INTAKE_INPUT_MAX = 240;
function intakeInlineInputWidth(charCount: number) {
  return Math.min(INTAKE_INPUT_MAX, Math.max(INTAKE_INPUT_MIN, (charCount + 2) * INTAKE_INPUT_CH));
}
const INTAKE_SEARCH_INPUT_MIN = 65;
function intakeSearchInputWidth(charCount: number) {
  return Math.min(INTAKE_INPUT_MAX, Math.max(INTAKE_SEARCH_INPUT_MIN, (charCount + 2) * INTAKE_INPUT_CH));
}

function intakeWhoProposalChipLabel(p: WhoProposal): string {
  if (p.type === "invite") {
    const n = p.label.replace(/^Invite\s+/i, "").trim();
    return `INVITE ${n.toUpperCase()}`;
  }
  if (p.type === "create_team") {
    const n = p.label.replace(/^Add\s+/i, "").trim();
    return `ADD ${n.toUpperCase()}`;
  }
  return p.label.toUpperCase();
}

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

type IntakeWhenTab = "due" | "milestone" | "repeat";
type IntakeMilestone = { id: string; date: string };

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
    if (/\bon(?:\s+the)?\s+\d{1,2}(?:st|nd|rd|th)?$/i.test(trimmed)) return false;

    return true;
  }, []);

  useEffect(() => {
    if (userEditedTitle) return;
    const aiRaw = aiResult?.title?.trim() || "";
    const fallback = buildFallbackTitleFromDescription(description);
    const chosen =
      aiRaw && isUsableGeneratedTitle(aiRaw)
        ? aiRaw
        : fallback;
    if (!chosen) return;
    const processed = chosen.charAt(0).toUpperCase() + chosen.slice(1).replace(/[.!]+$/, "");
    setAiTitleGenerated(processed);
    if (!title.trim()) setTitle(processed);
    setShowTitleField(true);
  }, [aiResult?.title, description, isUsableGeneratedTitle, userEditedTitle, title]);

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
  const [whenTab, setWhenTab] = useState<IntakeWhenTab>("due");
  const [milestones, setMilestones] = useState<IntakeMilestone[]>([]);
  const [milestoneDraftDate, setMilestoneDraftDate] = useState(format(startOfDay(new Date()), "yyyy-MM-dd"));
  const [repeatPreset, setRepeatPreset] = useState<"none" | "daily" | "weekly" | "monthly">("none");
  const [propertyId, setPropertyId] = useState(defaultPropertyId || "");
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [priorityDefined, setPriorityDefined] = useState(false);
  const [assignedUserId, setAssignedUserId] = useState<string | undefined>();
  const [assignedTeamIds, setAssignedTeamIds] = useState<string[]>([]);
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

  const [intakeWhoMode, setIntakeWhoMode] = useState<null | "person" | "team">(null);
  const [intakeWhoQuery, setIntakeWhoQuery] = useState("");
  /** After Enter on an unknown person name (no DB match yet), show INVITE [NAME] until clicked or slot closes. */
  const [intakeWhoInviteDraft, setIntakeWhoInviteDraft] = useState<string | null>(null);
  const [intakeWherePropertyPickerOpen, setIntakeWherePropertyPickerOpen] = useState(false);
  const [intakeWherePropertyQuery, setIntakeWherePropertyQuery] = useState("");
  const [intakeWhereSpaceEditing, setIntakeWhereSpaceEditing] = useState(false);
  const [intakeWhereSpaceQuery, setIntakeWhereSpaceQuery] = useState("");
  const [intakeWhenCustom, setIntakeWhenCustom] = useState(false);
  const [intakeAssetSearchOpen, setIntakeAssetSearchOpen] = useState(false);
  const [intakeAssetQuery, setIntakeAssetQuery] = useState("");
  const [intakeTagEditing, setIntakeTagEditing] = useState(false);
  const [intakeTagQuery, setIntakeTagQuery] = useState("");
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
  const [tagCreateOpen, setTagCreateOpen] = useState(false);
  const [tagCreateName, setTagCreateName] = useState("");
  const [tagCreating, setTagCreating] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<Array<{ id: string; name: string }>>([]);

  const { categories, refresh: refreshCategories } = useCategories();

  const intakeWhoPersonInputRef = useRef<HTMLInputElement>(null);
  const intakeWhoTeamInputRef = useRef<HTMLInputElement>(null);
  const intakeWhereSpaceInputRef = useRef<HTMLInputElement>(null);
  const intakeAssetInputRef = useRef<HTMLInputElement>(null);
  const intakeTagInputRef = useRef<HTMLInputElement>(null);

  const patchImage = useCallback((localId: string, patch: Partial<TempImage>) => {
    setImages((prev) => prev.map((img) => (img.local_id === localId ? { ...img, ...patch } : img)));
  }, []);

  const handleAnalysisComplete = useCallback((localId: string, result: import("@/types/temp-image").ImageAnalysisResult) => {
    setImages((prev) =>
      prev.map((img) => {
        if (img.local_id !== localId) return img;
        const meta = { ...(result.metadata || {}) };
        const isRouter = meta.router_mode === true;
        meta.intake_stage = isRouter ? "router" : "full";
        return {
          ...img,
          rawAnalysis: { ...result, metadata: meta },
          aiOcrText: result.ocr_text ?? "",
          detectedLabels: result.detected_labels || [],
        };
      })
    );
  }, []);

  const { imageOcrText, detectedLabels, runFullIntakeAnalysis } = useImageAnalysis({
    images,
    propertyId: propertyId || undefined,
    orgId: orgId ?? "",
    onAnalysisComplete: handleAnalysisComplete,
    onPatchImage: patchImage,
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
      selectedTeamIds: assignedTeamIds,
    },
    { minDescriptionLength: 3 }
  );

  const { members } = useOrgMembers();
  const { teams } = useTeams();
  const whoIntakeProposals = useWhoSuggestions(
    intakeWhoQuery,
    openChipSlot === "who" && intakeWhoMode !== null
  );
  const whoIntakePersonProposals = useMemo(() => {
    if (intakeWhoMode !== "person") return [];
    return whoIntakeProposals.filter((p) => p.type === "person" || p.type === "invite");
  }, [intakeWhoMode, whoIntakeProposals]);

  const whoIntakeTeamProposals = useMemo(() => {
    if (intakeWhoMode !== "team") return [];
    return whoIntakeProposals.filter((p) => p.type === "team" || p.type === "create_team");
  }, [intakeWhoMode, whoIntakeProposals]);

  const { spaces, refresh: refreshSpaces } = useSpaces(propertyId || undefined);

  useEffect(() => {
    if (openChipSlot !== "who") setIntakeWhoInviteDraft(null);
  }, [openChipSlot]);

  /** Dashboard property filter: keep intake location in sync with single-property scope */
  useEffect(() => {
    if (!defaultPropertyId) return;
    setPropertyId(defaultPropertyId);
    setSelectedSpaceIds([]);
  }, [defaultPropertyId]);

  useEffect(() => {
    if (!openChipSlot) {
      setIntakeWhoMode(null);
      setIntakeWhoQuery("");
      setIntakeWherePropertyPickerOpen(false);
      setIntakeWherePropertyQuery("");
      setIntakeWhereSpaceEditing(false);
      setIntakeWhereSpaceQuery("");
      setIntakeWhenCustom(false);
      setIntakeAssetSearchOpen(false);
      setIntakeAssetQuery("");
      setIntakeTagEditing(false);
      setIntakeTagQuery("");
    }
  }, [openChipSlot]);

  useEffect(() => {
    if (openChipSlot !== "who") return;
    const t = window.setTimeout(() => {
      if (intakeWhoMode === "person") intakeWhoPersonInputRef.current?.focus();
      if (intakeWhoMode === "team") intakeWhoTeamInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [openChipSlot, intakeWhoMode]);

  useEffect(() => {
    if (openChipSlot !== "where" || !intakeWhereSpaceEditing) return;
    const t = window.setTimeout(() => intakeWhereSpaceInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [openChipSlot, intakeWhereSpaceEditing]);

  useEffect(() => {
    if (openChipSlot !== "asset" || !intakeAssetSearchOpen) return;
    const t = window.setTimeout(() => intakeAssetInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [openChipSlot, intakeAssetSearchOpen]);

  useEffect(() => {
    if (openChipSlot !== "category" || !intakeTagEditing) return;
    const t = window.setTimeout(() => intakeTagInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [openChipSlot, intakeTagEditing]);

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
    if (openChipSlot === "when") {
      setWhenTab("due");
      if (!milestoneDraftDate) setMilestoneDraftDate(format(startOfDay(new Date()), "yyyy-MM-dd"));
    }
  }, [openChipSlot, milestoneDraftDate]);

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
    const normalizedDateValue = dateValue.replace(/(\d+)(st|nd|rd|th)\b/gi, "$1").replace(/,/g, "").trim();
    const isoLike = /^\d{4}-\d{2}-\d{2}$/.test(normalizedDateValue);
    const dateObj = normalizedDateValue
      ? new Date(isoLike ? `${normalizedDateValue}T00:00:00` : normalizedDateValue)
      : new Date();
    const isValidDateObj = !Number.isNaN(dateObj.getTime());
    if (!isValidDateObj) return dateValue.toUpperCase();
    const today = startOfDay(new Date());
    if (dateObj.getTime() === today.getTime()) return "TODAY";
    if (dateObj.getTime() === addDays(today, 1).getTime()) return "TOMORROW";
    return format(dateObj, "EEE d MMM").toUpperCase();
  }, []);

  const intakeRowChips: IntakeChipRowChip[] = useMemo(() => {
    const chips: IntakeChipRowChip[] = [];

    const assignedMember = members?.find((member) => member.user_id === assignedUserId);
    if (assignedMember?.display_name) {
      chips.push({
        id: `who-${assignedMember.user_id}`,
        slot: "who",
        label: assignedMember.display_name.toUpperCase(),
        epistemic: "fact",
        removable: true,
        onRemove: () => setAssignedUserId(undefined),
      });
    }

    assignedTeamIds.forEach((teamId) => {
      const team = teams.find((t) => t.id === teamId);
      const name = team?.name?.trim() || "Team";
      chips.push({
        id: `who-team-${teamId}`,
        slot: "who",
        label: name.toUpperCase(),
        epistemic: "fact",
        removable: true,
        onRemove: () => setAssignedTeamIds((prev) => prev.filter((id) => id !== teamId)),
      });
    });

    if (selectedProperty) {
      chips.push({
        id: `where-property-${selectedProperty.id}`,
        slot: "where",
        label: (selectedProperty.nickname || selectedProperty.address || "Property").toUpperCase(),
        epistemic: "fact",
        removable: true,
        onRemove: () => {
          setPropertyId(defaultPropertyId || "");
          setSelectedSpaceIds([]);
        },
      });
    }

    selectedSpaces.forEach((space) => {
      chips.push({
        id: `where-space-${space.id}`,
        slot: "where",
        label: space.name.toUpperCase(),
        epistemic: "fact",
        removable: true,
        onRemove: () => setSelectedSpaceIds((prev) => prev.filter((id) => id !== space.id)),
      });
    });

    selectedAssets.forEach((asset) => {
      chips.push({
        id: `asset-${asset.id}`,
        slot: "asset",
        label: asset.name.toUpperCase(),
        epistemic: "fact",
        removable: true,
        onRemove: () => setSelectedAssetIds((prev) => prev.filter((id) => id !== asset.id)),
      });
    });

    if (dueDate) {
      chips.push({
        id: `when-${dueDate}`,
        slot: "when",
        label: formatDueDateLabel(dueDate),
        epistemic: "fact",
        removable: true,
        onRemove: () => setDueDate(""),
      });
      if (repeatPreset !== "none") {
        chips.push({
          id: `when-repeat-${repeatPreset}`,
          slot: "when",
          label: `REPEAT ${repeatPreset.toUpperCase()}`,
          epistemic: "fact",
          removable: true,
          onRemove: () => setRepeatPreset("none"),
        });
      }
    }

    milestones.forEach((milestone) => {
      chips.push({
        id: `when-milestone-${milestone.id}`,
        slot: "when",
        label: `MS ${formatDueDateLabel(milestone.date)}`,
        epistemic: "fact",
        removable: true,
        onRemove: () => setMilestones((prev) => prev.filter((m) => m.id !== milestone.id)),
      });
    });

    if (priorityDefined && priority !== "medium") {
      chips.push({
        id: `priority-${priority}`,
        slot: "priority",
        label: priority.toUpperCase(),
        epistemic: "fact",
        removable: true,
        onRemove: () => {
          setPriority("medium");
          setPriorityDefined(false);
        },
      });
    }

    selectedThemeIds.forEach((themeId) => {
      if (themeId.startsWith("ghost-")) return;
      const theme = categories.find((c) => c.id === themeId);
      if (!theme?.name) return;
      chips.push({
        id: `category-${themeId}`,
        slot: "category",
        label: theme.name.toUpperCase(),
        epistemic: "fact",
        removable: true,
        onRemove: () => setSelectedThemeIds((prev) => prev.filter((id) => id !== themeId)),
      });
    });

    return chips;
  }, [
    assignedTeamIds,
    assignedUserId,
    categories,
    dueDate,
    milestones,
    formatDueDateLabel,
    members,
    priority,
    priorityDefined,
    repeatPreset,
    propertyId,
    selectedAssets,
    selectedProperty,
    selectedSpaces,
    selectedThemeIds,
    teams,
  ]);

  const toggleSpaceSelection = useCallback((spaceId: string) => {
    setSelectedSpaceIds((prev) =>
      prev.includes(spaceId) ? prev.filter((id) => id !== spaceId) : [...prev, spaceId]
    );
  }, []);

  const renderSlotContent = useCallback(
    (slot: IntakeChipSlotId, onClose: () => void): IntakeSlotPanelRows => {
      if (slot === "who") {
        const q = intakeWhoQuery.trim().toLowerCase();
        const ranked = [...members].sort((a, b) => {
          const na = (a.display_name || a.email || "").toLowerCase();
          const nb = (b.display_name || b.email || "").toLowerCase();
          if (!q) return 0;
          const sa = na.startsWith(q) ? 0 : na.includes(q) ? 1 : 2;
          const sb = nb.startsWith(q) ? 0 : nb.includes(q) ? 1 : 2;
          if (sa !== sb) return sa - sb;
          return na.localeCompare(nb);
        });
        const visible = q ? ranked.filter((m) => (m.display_name || m.email || "").toLowerCase().includes(q)) : ranked;

        const teamQ = intakeWhoQuery.trim().toLowerCase();
        const rankedTeams = [...teams].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        const visibleTeams = teamQ
          ? rankedTeams.filter((t) => (t.name || "").toLowerCase().includes(teamQ))
          : rankedTeams;

        const whoInputW = intakeInlineInputWidth(intakeWhoQuery.length);

        const resetWhoInput = () => {
          setIntakeWhoMode(null);
          setIntakeWhoQuery("");
        };

        const openInviteModalFromRawName = (nameRaw: string) => {
          const t = nameRaw.trim();
          const parsed = splitName(t);
          setInvitePrefill({
            firstName: parsed.firstName || t,
            lastName: parsed.lastName,
          });
          setInviteModalOpen(true);
          setIntakeWhoInviteDraft(null);
          resetWhoInput();
        };

        const pickMember = (userId: string) => {
          setAssignedUserId(userId);
          setIntakeWhoInviteDraft(null);
          resetWhoInput();
          onClose();
        };

        const handleIntakeWhoProposal = (p: WhoProposal) => {
          if (p.type === "person" && p.entityId) {
            pickMember(p.entityId);
          } else if (p.type === "invite") {
            const nameFromLabel = p.label.replace(/^Invite\s+/i, "").trim();
            openInviteModalFromRawName(nameFromLabel);
          } else if (p.type === "team" && p.entityId) {
            setAssignedTeamIds((prev) =>
              prev.includes(p.entityId as string) ? prev : [...prev, p.entityId as string]
            );
            setIntakeWhoInviteDraft(null);
            resetWhoInput();
            onClose();
          } else if (p.type === "create_team") {
            toast({
              title: "New team",
              description: "Create teams from Create Task, then assign them there.",
            });
            setIntakeWhoInviteDraft(null);
            resetWhoInput();
          }
        };

        const proposalPersonIds = new Set(
          whoIntakePersonProposals.filter((p) => p.type === "person" && p.entityId).map((p) => p.entityId as string)
        );
        const extraMemberChips =
          intakeWhoMode === "person"
            ? (q
                ? visible.filter((m) => !proposalPersonIds.has(m.user_id) && m.user_id !== assignedUserId)
                : visible.filter((m) => m.user_id !== assignedUserId)
              ).slice(0, 24)
            : [];

        const proposalTeamIds = new Set(
          whoIntakeTeamProposals.filter((p) => p.type === "team" && p.entityId).map((p) => p.entityId as string)
        );
        const extraTeamChips =
          intakeWhoMode === "team"
            ? (teamQ
                ? visibleTeams.filter(
                    (t) => !proposalTeamIds.has(t.id) && !assignedTeamIds.includes(t.id)
                  )
                : visibleTeams.filter((t) => !assignedTeamIds.includes(t.id))
              ).slice(0, 24)
            : [];

        return {
          row2: (
            <>
              {intakeWhoMode === null && (
                <input
                  type="text"
                  value={intakeWhoQuery}
                  onChange={(e) => setIntakeWhoQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setIntakeWhoQuery("");
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const first = ranked.find((m) => m.user_id !== assignedUserId);
                      if (first) pickMember(first.user_id);
                    }
                  }}
                  placeholder="SEARCH"
                className={cn(INTAKE_INLINE_INPUT_CLASS, "min-w-[65px]")}
                style={{ width: intakeSearchInputWidth(intakeWhoQuery.length) }}
                />
              )}
              {intakeWhoMode === "person" ? (
                <input
                  ref={intakeWhoPersonInputRef}
                  type="text"
                  value={intakeWhoQuery}
                  onChange={(e) => setIntakeWhoQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      resetWhoInput();
                    }
                    if (e.key === "Enter" && intakeWhoQuery.trim()) {
                      e.preventDefault();
                      const trimmed = intakeWhoQuery.trim();
                      if (whoIntakePersonProposals[0]) {
                        handleIntakeWhoProposal(whoIntakePersonProposals[0]);
                      } else if (visible[0]) {
                        pickMember(visible[0].user_id);
                      } else {
                        setIntakeWhoInviteDraft(trimmed);
                        resetWhoInput();
                      }
                    }
                  }}
                  onBlur={() => {
                    window.setTimeout(() => {
                      resetWhoInput();
                    }, 150);
                  }}
                  placeholder="+ PERSON"
                  className={INTAKE_INLINE_INPUT_CLASS}
                  style={{ width: whoInputW }}
                />
              ) : (
                <SemanticChip
                  epistemic="proposal"
                  label="+ PERSON"
                  truncate={false}
                  pressOnPointerDown
                  onPress={() => {
                    setIntakeWhoMode("person");
                    setIntakeWhoQuery("");
                  }}
                  className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1 h-[24px]"
                />
              )}
              {intakeWhoMode === "team" ? (
                <input
                  ref={intakeWhoTeamInputRef}
                  type="text"
                  value={intakeWhoQuery}
                  onChange={(e) => setIntakeWhoQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      resetWhoInput();
                    }
                    if (e.key === "Enter" && intakeWhoQuery.trim()) {
                      e.preventDefault();
                      if (whoIntakeTeamProposals[0]) {
                        handleIntakeWhoProposal(whoIntakeTeamProposals[0]);
                      } else if (visibleTeams[0]) {
                        const t0 = visibleTeams[0];
                        setAssignedTeamIds((prev) => (prev.includes(t0.id) ? prev : [...prev, t0.id]));
                        setIntakeWhoInviteDraft(null);
                        resetWhoInput();
                        onClose();
                      }
                    }
                  }}
                  onBlur={() => {
                    window.setTimeout(() => {
                      resetWhoInput();
                    }, 150);
                  }}
                  placeholder="+ TEAM"
                  className={INTAKE_INLINE_INPUT_CLASS}
                  style={{ width: whoInputW }}
                />
              ) : (
                <SemanticChip
                  epistemic="proposal"
                  label="+ TEAM"
                  truncate={false}
                  pressOnPointerDown
                  onPress={() => {
                    setIntakeWhoMode("team");
                    setIntakeWhoQuery("");
                  }}
                  className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1 h-[24px]"
                />
              )}
            </>
          ),
          row3: (
            <>
              {(assignedUserId || assignedTeamIds.length > 0) && (
                <SemanticChip
                  epistemic="proposal"
                  label="CLEAR"
                  truncate={false}
                  pressOnPointerDown
                  onPress={() => {
                    setAssignedUserId(undefined);
                    setAssignedTeamIds([]);
                  }}
                  className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1 h-[24px]"
                />
              )}
              {intakeWhoInviteDraft && (
                <SemanticChip
                  epistemic="proposal"
                  label={`INVITE ${intakeWhoInviteDraft.toUpperCase()}`}
                  truncate={false}
                  pressOnPointerDown
                  onPress={() => openInviteModalFromRawName(intakeWhoInviteDraft)}
                  className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1 h-[24px]"
                />
              )}
              {intakeWhoMode === null &&
                ranked
                  .filter((m) => m.user_id !== assignedUserId)
                  .slice(0, 24)
                  .map((member) => (
                  <SemanticChip
                    key={member.user_id}
                    epistemic="proposal"
                    label={(member.display_name || member.email || "Member").toUpperCase()}
                    truncate
                    pressOnPointerDown
                    onPress={() => pickMember(member.user_id)}
                    className="shrink-0 max-w-[220px]"
                  />
                ))}
              {intakeWhoMode === "person" &&
                whoIntakePersonProposals
                  .filter(
                    (p) => !(p.type === "person" && p.entityId && p.entityId === assignedUserId)
                  )
                  .map((proposal) => (
                  <SemanticChip
                    key={proposal.id}
                    epistemic="proposal"
                    label={intakeWhoProposalChipLabel(proposal)}
                    truncate
                    pressOnPointerDown
                    onPress={() => handleIntakeWhoProposal(proposal)}
                    className="shrink-0 max-w-[220px]"
                  />
                ))}
              {intakeWhoMode === "team" &&
                whoIntakeTeamProposals
                  .filter((p) => !(p.type === "team" && p.entityId && assignedTeamIds.includes(p.entityId as string)))
                  .map((proposal) => (
                  <SemanticChip
                    key={proposal.id}
                    epistemic="proposal"
                    label={intakeWhoProposalChipLabel(proposal)}
                    truncate
                    pressOnPointerDown
                    onPress={() => handleIntakeWhoProposal(proposal)}
                    className="shrink-0 max-w-[220px]"
                  />
                ))}
              {intakeWhoMode === "person" &&
                extraMemberChips.map((member) => (
                  <SemanticChip
                    key={member.user_id}
                    epistemic={assignedUserId === member.user_id ? "fact" : "proposal"}
                    label={(member.display_name || member.email || "Member").toUpperCase()}
                    truncate
                    pressOnPointerDown
                    onPress={() => pickMember(member.user_id)}
                    className="shrink-0 max-w-[220px]"
                  />
                ))}
              {intakeWhoMode === "team" &&
                extraTeamChips.map((team) => (
                  <SemanticChip
                    key={team.id}
                    epistemic="proposal"
                    label={(team.name || "Team").toUpperCase()}
                    truncate
                    pressOnPointerDown
                    onPress={() => {
                      setAssignedTeamIds((prev) => (prev.includes(team.id) ? prev : [...prev, team.id]));
                      resetWhoInput();
                      onClose();
                    }}
                    className="shrink-0 max-w-[220px]"
                  />
                ))}
            </>
          ),
        };
      }

      if (slot === "where") {
        const pq = intakeWherePropertyQuery.trim().toLowerCase();
        const unresolvedSpaceSuggestions = chipSuggestions.filter(
          (chip) =>
            chip.type === "space" &&
            chip.blockingRequired &&
            !chip.resolvedEntityId &&
            !selectedSpaces.some((space) => space.name.toLowerCase() === chip.label.toLowerCase())
        );
        const sq = intakeWhereSpaceQuery.trim().toLowerCase();
        const spacePickSuggestions =
          propertyId && sq
            ? spaces.filter((s) => s.name.toLowerCase().includes(sq)).slice(0, 4)
            : [];
        const hasExactSpaceMatch =
          Boolean(sq) && spaces.some((s) => s.name.toLowerCase() === sq);
        const spaceInputW = intakeInlineInputWidth(intakeWhereSpaceQuery.length);
        const propertyMatches = properties.filter((p: { id: string; nickname?: string; address?: string }) => {
          if (p.id === selectedProperty?.id) return false;
          if (!pq) return true;
          const label = `${p.nickname || ""} ${p.address || ""}`.toLowerCase();
          return label.includes(pq);
        });
        const otherProperties = propertyMatches.slice(0, 12);
        const propertySearchW = intakeInlineInputWidth(intakeWherePropertyQuery.length);

        return {
          row2: (
            <>
              <input
                type="text"
                value={intakeWherePropertyQuery}
                onChange={(e) => setIntakeWherePropertyQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setIntakeWherePropertyQuery("");
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const first = propertyMatches[0];
                    if (!first) return;
                    setPropertyId(first.id);
                    setSelectedSpaceIds([]);
                    setIntakeWherePropertyQuery("");
                  }
                }}
                placeholder="SEARCH"
                className={cn(INTAKE_INLINE_INPUT_CLASS, "min-w-[65px]")}
                style={{ width: intakeSearchInputWidth(intakeWherePropertyQuery.length) }}
              />
              {intakeWherePropertyPickerOpen ? (
                <>
                  <SemanticChip
                    epistemic="proposal"
                    label="Add property"
                    truncate={false}
                    onPress={() => setShowAddPropertyDialog(true)}
                    className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1"
                  />
                  {properties.slice(0, 12).map((p: Record<string, unknown> & { id: string; icon_name?: string }) => {
                    if (selectedProperty?.id === p.id) return null;
                    const Icon = getAssetIcon(p.icon_name || "building");
                    const label =
                      (typeof p.nickname === "string" && p.nickname) ||
                      (typeof p.address === "string" && p.address) ||
                      "Property";
                    const color =
                      typeof p.icon_color_hex === "string" && p.icon_color_hex ? p.icon_color_hex : "#8EC9CE";
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPropertyId(p.id);
                          setSelectedSpaceIds([]);
                          setIntakeWherePropertyPickerOpen(false);
                        }}
                        className="h-[28px] w-[28px] rounded-[8px] shrink-0 flex items-center justify-center shadow-e1"
                        style={{ backgroundColor: color }}
                        aria-label={label}
                      >
                        <Icon className="h-4 w-4 text-white" />
                      </button>
                    );
                  })}
                </>
              ) : (
                <SemanticChip
                  epistemic="proposal"
                  label="+ PROPERTY"
                  truncate={false}
                  pressOnPointerDown
                  onPress={() => {
                    setIntakeWherePropertyPickerOpen(true);
                    setIntakeWhereSpaceEditing(false);
                    setIntakeWhereSpaceQuery("");
                  }}
                  className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1 h-[24px]"
                />
              )}
              {intakeWhereSpaceEditing ? (
                <>
                  <input
                    ref={intakeWhereSpaceInputRef}
                    type="text"
                    value={intakeWhereSpaceQuery}
                    onChange={(e) => setIntakeWhereSpaceQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setIntakeWhereSpaceEditing(false);
                        setIntakeWhereSpaceQuery("");
                      }
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const first = spacePickSuggestions[0];
                        if (first) {
                          toggleSpaceSelection(first.id);
                          setIntakeWhereSpaceEditing(false);
                          setIntakeWhereSpaceQuery("");
                        } else if (intakeWhereSpaceQuery.trim() && !hasExactSpaceMatch) {
                          setSpaceDraftName(intakeWhereSpaceQuery.trim());
                          setShowAddSpaceDialog(true);
                        }
                      }
                    }}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setIntakeWhereSpaceEditing(false);
                        setIntakeWhereSpaceQuery("");
                      }, 150);
                    }}
                    placeholder="+ SPACE"
                    className={INTAKE_INLINE_INPUT_CLASS}
                    style={{ width: spaceInputW }}
                  />
                </>
              ) : (
                <SemanticChip
                  epistemic="proposal"
                  label="+ SPACE"
                  truncate={false}
                  pressOnPointerDown
                  onPress={() => {
                    if (!propertyId) {
                      toast({
                        title: "Choose a property first",
                        description: "Pick a property before adding a space.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setIntakeWhereSpaceEditing(true);
                    setIntakeWherePropertyPickerOpen(false);
                    setIntakeWhereSpaceQuery("");
                  }}
                  className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1 h-[24px]"
                />
              )}
            </>
          ),
          row3: (
            <>
              {!intakeWherePropertyPickerOpen &&
                otherProperties.map((property: { id: string; icon_name?: string; nickname?: string; address?: string; icon_color_hex?: string }) => {
                  const Icon = getAssetIcon(property.icon_name || "building");
                  const fullLabel = (property.nickname || property.address || "Property").toUpperCase();
                  const color =
                    typeof property.icon_color_hex === "string" && property.icon_color_hex.trim()
                      ? property.icon_color_hex.trim()
                      : "#8EC9CE";
                  const compactPropertyChip =
                    Boolean(defaultPropertyId) && property.id !== defaultPropertyId;
                  if (compactPropertyChip) {
                    return (
                      <button
                        key={property.id}
                        type="button"
                        title={fullLabel}
                        aria-label={fullLabel}
                        onClick={() => {
                          setPropertyId(property.id);
                          setSelectedSpaceIds([]);
                        }}
                        className="h-6 w-6 shrink-0 flex items-center justify-center rounded-[8px] bg-background/70 shadow-e1"
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color }} />
                      </button>
                    );
                  }
                  return (
                    <SemanticChip
                      key={property.id}
                      epistemic="proposal"
                      label={fullLabel}
                      icon={<Icon className="h-3.5 w-3.5" />}
                      truncate
                      pressOnPointerDown
                      onPress={() => {
                        setPropertyId(property.id);
                        setSelectedSpaceIds([]);
                      }}
                      className="shrink-0 max-w-[200px]"
                    />
                  );
                })}
              {intakeWhereSpaceEditing &&
                spacePickSuggestions.map((s) => (
                  <SemanticChip
                    key={s.id}
                    epistemic="proposal"
                    label={`+${s.name}`.toUpperCase()}
                    truncate={false}
                    pressOnPointerDown
                    onPress={() => {
                      toggleSpaceSelection(s.id);
                      setIntakeWhereSpaceEditing(false);
                      setIntakeWhereSpaceQuery("");
                    }}
                    className="shrink-0"
                  />
                ))}
              {intakeWhereSpaceEditing && intakeWhereSpaceQuery.trim() && !hasExactSpaceMatch && (
                <SemanticChip
                  epistemic="proposal"
                  label={`ADD ${intakeWhereSpaceQuery.trim().toUpperCase()}`}
                  truncate={false}
                  pressOnPointerDown
                  onPress={() => {
                    setSpaceDraftName(intakeWhereSpaceQuery.trim());
                    setShowAddSpaceDialog(true);
                  }}
                  className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1 max-w-[200px]"
                />
              )}
              {propertyId &&
                !intakeWhereSpaceEditing &&
                spaces.map((space) => {
                  const Icon = getAssetIcon((space as { icon_name?: string }).icon_name);
                  const selected = selectedSpaceIds.includes(space.id);
                  return (
                    <SemanticChip
                      key={space.id}
                      epistemic={selected ? "fact" : "proposal"}
                      label={space.name.toUpperCase()}
                      icon={<Icon className="h-3.5 w-3.5" />}
                      truncate
                      pressOnPointerDown
                      onPress={() => toggleSpaceSelection(space.id)}
                      className="shrink-0 max-w-[200px]"
                    />
                  );
                })}
              {!intakeWhereSpaceEditing &&
                unresolvedSpaceSuggestions.map((chip) => (
                  <SemanticChip
                    key={chip.id}
                    epistemic="proposal"
                    label={`ADD ${chip.label.toUpperCase()}`}
                    truncate={false}
                    pressOnPointerDown
                    onPress={() => {
                      setSpaceDraftName(chip.label);
                      setShowAddSpaceDialog(true);
                    }}
                    className="shrink-0"
                  />
                ))}
            </>
          ),
        };
      }

      if (slot === "when") {
        const today = startOfDay(new Date());
        const quick = [
          { label: "TODAY", date: format(today, "yyyy-MM-dd") },
          { label: "TOMORROW", date: format(addDays(today, 1), "yyyy-MM-dd") },
          { label: "7 DAYS", date: format(addDays(today, 7), "yyyy-MM-dd") },
          { label: "1 MO", date: format(addMonths(today, 1), "yyyy-MM-dd") },
        ];
        const selectedDueDate = dueDate ? new Date(`${dueDate}T00:00:00`) : undefined;
        const selectedMilestoneDate = milestoneDraftDate ? new Date(`${milestoneDraftDate}T00:00:00`) : undefined;
        const activeWhenDate = whenTab === "milestone" ? milestoneDraftDate : dueDate;
        const dueDateChipLabel = dueDate
          ? `DUE ${format(new Date(`${dueDate}T00:00:00`), "d MMMM").toUpperCase()}`
          : "DUE DATE";
        const applyQuick = (date: string) => {
          setIntakeWhenCustom(false);
          if (whenTab === "milestone") {
            setMilestoneDraftDate(date);
            return;
          }
          setDueDate(date);
        };
        const calendarSelected = whenTab === "milestone" ? selectedMilestoneDate : selectedDueDate;
        const whenRow2 = !intakeWhenCustom ? (
          <>
            {quick.map(({ label: ql, date }) => (
              <SemanticChip
                key={ql}
                epistemic={activeWhenDate === date ? "fact" : "proposal"}
                label={ql}
                truncate={false}
                pressOnPointerDown
                onPress={() => applyQuick(date)}
                className="shrink-0 text-[11px]"
              />
            ))}
            <SemanticChip
              epistemic="proposal"
              label="CUSTOM"
              truncate={false}
              pressOnPointerDown
              onPress={() => setIntakeWhenCustom(true)}
              className="shrink-0 text-[11px]"
            />
          </>
        ) : (
          <>
            <SemanticChip
              epistemic={whenTab === "due" && dueDate ? "fact" : "proposal"}
              label={dueDateChipLabel}
              truncate={false}
              pressOnPointerDown
              onPress={() => setWhenTab("due")}
              className="shrink-0 text-[11px]"
            />
            <SemanticChip
              epistemic={whenTab === "milestone" ? "fact" : "proposal"}
              label="+ MILESTONE"
              truncate={false}
              pressOnPointerDown
              onPress={() => setWhenTab("milestone")}
              className="shrink-0 text-[11px]"
            />
            <SemanticChip
              epistemic={whenTab === "repeat" ? "fact" : "proposal"}
              label="REPEAT"
              truncate={false}
              pressOnPointerDown
              onPress={() => setWhenTab("repeat")}
              className="shrink-0 text-[11px]"
            />
          </>
        );

        return {
          row2: whenRow2,
          row3: (
            <div className="flex w-full min-w-0 shrink-0 flex-col gap-2">
            {whenTab === "repeat" && (
              <div className="flex flex-wrap gap-2">
                {(["daily", "weekly", "monthly"] as const).map((option) => (
                  <SemanticChip
                    key={option}
                    epistemic={repeatPreset === option ? "fact" : "proposal"}
                    label={option.toUpperCase()}
                    truncate={false}
                    pressOnPointerDown
                    onPress={() => setRepeatPreset(option)}
                    className="shrink-0"
                  />
                ))}
                {repeatPreset !== "none" && (
                  <SemanticChip
                    epistemic="proposal"
                    label="CLEAR"
                    truncate={false}
                    pressOnPointerDown
                    onPress={() => setRepeatPreset("none")}
                    className="shrink-0"
                  />
                )}
              </div>
            )}

            {intakeWhenCustom && (
              <div className="rounded-lg bg-background/80 p-2 w-fit">
                <MiniCalendar
                  mode="single"
                  classNames={{
                    month: "space-y-4 w-[246px]",
                    caption: "flex justify-start pt-1 relative items-start gap-2.5 pl-[7px]",
                    caption_label: "text-base font-medium",
                    table: "w-full border-collapse space-y-1 mt-[10px]",
                    head_cell: "text-[#85BABC] rounded-md w-[30px] font-semibold text-[0.8rem] font-mono",
                    tbody: "rdp-tbody mt-0 rounded-[5px]",
                    row: "flex w-full !mt-[1px] !mb-[1px] py-0 justify-start items-start font-mono",
                    cell: "h-[30px] w-[30px] rounded-[12px] text-center text-sm p-0 relative font-mono [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                    day: "h-[30px] w-[30px] p-0 text-xs font-normal font-mono rounded-[12px] grid items-center justify-center aria-selected:opacity-100",
                    day_today:
                      "bg-white/30 text-foreground border-none shadow-[inset_0px_6.2px_3.9px_-1.2px_rgba(0,0,0,0.2),0px_1px_1px_0px_rgba(255,255,255,1)]",
                    nav: "ml-[3px] flex items-start justify-end gap-1 text-center",
                    nav_button:
                      "h-7 w-7 rounded-full p-0 text-muted-foreground shadow-e1 hover:text-foreground hover:shadow-inset",
                    nav_button_previous: "absolute top-1 left-[177px] flex items-center justify-center",
                  }}
                  components={{
                    IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />,
                    IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" strokeWidth={2.2} />,
                  }}
                  selected={calendarSelected}
                  onSelect={(date) => {
                    if (!date) return;
                    const next = format(date, "yyyy-MM-dd");
                    if (whenTab === "milestone") {
                      setMilestoneDraftDate(next);
                    } else {
                      setDueDate(next);
                    }
                  }}
                />
              </div>
            )}

            {whenTab !== "repeat" && !intakeWhenCustom && whenTab === "due" && (
              <span className="sr-only">Choose a quick date in row above, or Custom for the calendar.</span>
            )}

            {whenTab === "milestone" && intakeWhenCustom && (
              <div className="flex w-full min-w-0 flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!milestoneDraftDate) return;
                    setMilestones((prev) => [...prev, { id: crypto.randomUUID(), date: milestoneDraftDate }]);
                  }}
                  className="self-start shrink-0 rounded-[8px] px-2 py-1 text-[10px] font-mono uppercase tracking-wide text-muted-foreground shadow-e1 hover:text-foreground"
                >
                  Add milestone
                </button>
                {milestones.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {milestones.map((milestone) => (
                      <SemanticChip
                        key={milestone.id}
                        epistemic="fact"
                        label={formatDueDateLabel(milestone.date)}
                        removable
                        onRemove={() => setMilestones((prev) => prev.filter((m) => m.id !== milestone.id))}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            </div>
          ),
        };
      }

      if (slot === "asset") {
        const unresolvedAssetSuggestions = chipSuggestions.filter(
          (chip) =>
            chip.type === "asset" &&
            chip.blockingRequired &&
            !chip.resolvedEntityId &&
            !selectedAssets.some((asset) => asset.name.toLowerCase() === (chip.value || chip.label).toLowerCase())
        );
        const aq = intakeAssetQuery.trim().toLowerCase();
        const assetsRanked = availableAssets.filter((asset) => !aq || asset.name.toLowerCase().includes(aq));
        const assetInlineTop = intakeAssetSearchOpen ? assetsRanked.slice(0, 4) : [];
        const assetInputW = intakeInlineInputWidth(intakeAssetQuery.length);
        const hasExactAssetMatch =
          Boolean(aq) && availableAssets.some((a) => a.name.toLowerCase() === aq);

        return {
          row2: (
            <>
              {!intakeAssetSearchOpen && (
                <input
                  type="text"
                  value={intakeAssetQuery}
                  onChange={(e) => setIntakeAssetQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setIntakeAssetQuery("");
                    if (e.key === "Enter" && intakeAssetQuery.trim()) {
                      e.preventDefault();
                      const exact = availableAssets.find(
                        (a) => a.name.toLowerCase() === intakeAssetQuery.trim().toLowerCase()
                      );
                      if (exact) {
                        setSelectedAssetIds((prev) => (prev.includes(exact.id) ? prev : [...prev, exact.id]));
                      }
                    }
                  }}
                  placeholder="SEARCH"
                className={cn(INTAKE_INLINE_INPUT_CLASS, "min-w-[65px]")}
                style={{ width: intakeSearchInputWidth(intakeAssetQuery.length) }}
                />
              )}
              {intakeAssetSearchOpen && propertyId ? (
                <input
                  ref={intakeAssetInputRef}
                  type="text"
                  value={intakeAssetQuery}
                  onChange={(e) => setIntakeAssetQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setIntakeAssetSearchOpen(false);
                      setIntakeAssetQuery("");
                    }
                    if (e.key === "Enter" && intakeAssetQuery.trim()) {
                      e.preventDefault();
                      const exact = availableAssets.find(
                        (a) => a.name.toLowerCase() === intakeAssetQuery.trim().toLowerCase()
                      );
                      if (exact) {
                        setSelectedAssetIds((prev) => (prev.includes(exact.id) ? prev : [...prev, exact.id]));
                        setIntakeAssetQuery("");
                        setIntakeAssetSearchOpen(false);
                      } else {
                        setAssetDraftName(intakeAssetQuery.trim());
                        setShowCreateAssetDialog(true);
                      }
                    }
                  }}
                  onBlur={() => {
                    window.setTimeout(() => {
                      setIntakeAssetSearchOpen(false);
                      setIntakeAssetQuery("");
                    }, 150);
                  }}
                  placeholder="+ ASSET"
                  className={INTAKE_INLINE_INPUT_CLASS}
                  style={{ width: assetInputW }}
                />
              ) : (
                <SemanticChip
                  epistemic="proposal"
                  label="+ ASSET"
                  truncate={false}
                  pressOnPointerDown
                  onPress={() => {
                    if (!propertyId) {
                      setOpenChipSlot("where");
                      toast({
                        title: "Choose a property first",
                        description: "Pick a property before adding assets.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setIntakeAssetSearchOpen(true);
                    setIntakeAssetQuery("");
                  }}
                  className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1 h-[24px]"
                />
              )}
            </>
          ),
          row3: (
            <>
              {!propertyId && (
                <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">
                  Pick a property first
                </span>
              )}
              {intakeAssetSearchOpen &&
                propertyId &&
                assetInlineTop.map((asset) => (
                  <SemanticChip
                    key={`asset-inline-${asset.id}`}
                    epistemic="proposal"
                    label={`+${asset.name}`.toUpperCase()}
                    truncate={false}
                    pressOnPointerDown
                    onPress={() => {
                      setSelectedAssetIds((prev) =>
                        prev.includes(asset.id) ? prev.filter((id) => id !== asset.id) : [...prev, asset.id]
                      );
                      setIntakeAssetSearchOpen(false);
                      setIntakeAssetQuery("");
                    }}
                    className="shrink-0"
                  />
                ))}
              {intakeAssetSearchOpen &&
                propertyId &&
                intakeAssetQuery.trim() &&
                !hasExactAssetMatch && (
                  <SemanticChip
                    epistemic="proposal"
                    label={`ADD ${intakeAssetQuery.trim().toUpperCase()}`}
                    truncate={false}
                    pressOnPointerDown
                    onPress={() => {
                      setAssetDraftName(intakeAssetQuery.trim());
                      setShowCreateAssetDialog(true);
                    }}
                    className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1 max-w-[200px]"
                  />
                )}
              {propertyId &&
                assetsRanked
                  .filter((asset) => !selectedAssetIds.includes(asset.id))
                  .slice(0, 20)
                  .map((asset) => (
                  <SemanticChip
                    key={asset.id}
                    epistemic="proposal"
                    label={asset.name.toUpperCase()}
                    truncate
                    pressOnPointerDown
                    onPress={() => {
                      setSelectedAssetIds((prev) =>
                        prev.includes(asset.id) ? prev.filter((id) => id !== asset.id) : [...prev, asset.id]
                      );
                    }}
                    className="shrink-0 max-w-[200px]"
                  />
                ))}
              {propertyId &&
                unresolvedAssetSuggestions.map((chip) => (
                  <SemanticChip
                    key={chip.id}
                    epistemic="proposal"
                    label={`ADD ${(chip.value || chip.label).toUpperCase()}`}
                    truncate={false}
                    pressOnPointerDown
                    onPress={() => {
                      setAssetDraftName(chip.value || chip.label);
                      setShowCreateAssetDialog(true);
                    }}
                    className="shrink-0"
                  />
                ))}
            </>
          ),
        };
      }

      if (slot === "priority") {
        const levels = ["low", "medium", "high", "urgent"] as const;
        return {
          row2: (
            <>
              {levels.map((p) => (
                <SemanticChip
                  key={p}
                  epistemic={priority === p ? "fact" : "proposal"}
                  label={p === "medium" ? "NORMAL" : p.toUpperCase()}
                  truncate={false}
                  pressOnPointerDown
                  onPress={() => {
                    setPriority(p);
                    setPriorityDefined(true);
                    onClose();
                  }}
                  className="shrink-0"
                />
              ))}
            </>
          ),
          row3: (
            <span className="sr-only">Default priority is normal unless you pick low, high, or urgent.</span>
          ),
        };
      }

      if (slot === "category") {
        const selectedCategoryIds = selectedThemeIds.filter((id) => !id.startsWith("ghost-"));
        const selectedCats = categories.filter((c) => selectedCategoryIds.includes(c.id));
        const tq = intakeTagQuery.trim().toLowerCase();
        const tagSuggestionsInline =
          intakeTagEditing && tq
            ? categories
                .filter((c) => c.name.toLowerCase().includes(tq))
                .filter((c) => !selectedCategoryIds.includes(c.id))
                .slice(0, 4)
            : [];
        const hasExactTagMatch = Boolean(tq) && categories.some((c) => c.name.toLowerCase() === tq);
        const tagInputW = intakeInlineInputWidth(intakeTagQuery.length);
        const tagMatches = categories.filter((c) => !tq || c.name.toLowerCase().includes(tq));

        const commitTagId = (id: string) => {
          if (selectedThemeIds.includes(id)) return;
          setSelectedThemeIds((prev) => [...prev, id]);
          setIntakeTagEditing(false);
          setIntakeTagQuery("");
        };

        return {
          row2: (
            <>
              {selectedCats.map((c) => (
                <SemanticChip
                  key={c.id}
                  epistemic="fact"
                  label={c.name.toUpperCase()}
                  removable
                  onRemove={() => setSelectedThemeIds((prev) => prev.filter((x) => x !== c.id))}
                  truncate
                  className="shrink-0 max-w-[200px]"
                />
              ))}
              {!intakeTagEditing && (
                <input
                  type="text"
                  value={intakeTagQuery}
                  onChange={(e) => setIntakeTagQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setIntakeTagQuery("");
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const first = tagMatches.find((cat) => !selectedThemeIds.includes(cat.id));
                      if (first) commitTagId(first.id);
                    }
                  }}
                  placeholder="SEARCH"
                className={cn(INTAKE_INLINE_INPUT_CLASS, "min-w-[65px]")}
                style={{ width: intakeSearchInputWidth(intakeTagQuery.length) }}
                />
              )}
              {intakeTagEditing ? (
                <input
                  ref={intakeTagInputRef}
                  type="text"
                  value={intakeTagQuery}
                  onChange={(e) => setIntakeTagQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setIntakeTagEditing(false);
                      setIntakeTagQuery("");
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const first = tagSuggestionsInline[0];
                      if (first) commitTagId(first.id);
                      else if (intakeTagQuery.trim() && !hasExactTagMatch) {
                        setTagCreateName(intakeTagQuery.trim());
                        setTagCreateOpen(true);
                      }
                    }
                  }}
                  onBlur={() => {
                    window.setTimeout(() => {
                      setIntakeTagEditing(false);
                      setIntakeTagQuery("");
                    }, 150);
                  }}
                  placeholder="ADD TAG"
                  className={INTAKE_INLINE_INPUT_CLASS}
                  style={{ width: tagInputW }}
                />
              ) : (
                <SemanticChip
                  epistemic="proposal"
                  label="+ TAG"
                  truncate={false}
                  pressOnPointerDown
                  onPress={() => {
                    setIntakeTagEditing(true);
                    setIntakeTagQuery("");
                  }}
                  className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1 h-[24px]"
                />
              )}
            </>
          ),
          row3: (
            <>
              {intakeTagEditing &&
                tagSuggestionsInline.map((c) => (
                  <SemanticChip
                    key={c.id}
                    epistemic="proposal"
                    label={`+${c.name}`.toUpperCase()}
                    truncate={false}
                    pressOnPointerDown
                    onPress={() => commitTagId(c.id)}
                    className="shrink-0"
                  />
                ))}
              {intakeTagEditing && intakeTagQuery.trim() && !hasExactTagMatch && (
                <SemanticChip
                  epistemic="proposal"
                  label={`ADD ${intakeTagQuery.trim().toUpperCase()}`}
                  truncate={false}
                  pressOnPointerDown
                  onPress={() => {
                    setTagCreateName(intakeTagQuery.trim());
                    setTagCreateOpen(true);
                  }}
                  className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1 max-w-[200px]"
                />
              )}
              {tagMatches
                .filter((cat) => !selectedThemeIds.includes(cat.id))
                .slice(0, 20)
                .map((cat) => (
                <SemanticChip
                  key={cat.id}
                  epistemic="proposal"
                  label={cat.name.toUpperCase()}
                  truncate
                  pressOnPointerDown
                  onPress={() => {
                    setSelectedThemeIds((prev) =>
                      prev.includes(cat.id) ? prev.filter((id) => id !== cat.id) : [...prev, cat.id]
                    );
                  }}
                  className="shrink-0 max-w-[200px]"
                />
              ))}
            </>
          ),
        };
      }

      if (slot === "compliance") {
        return {
          row2: (
            <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">
              Use compliance fields above
            </span>
          ),
          row3: <span className="sr-only">Compliance</span>,
        };
      }

      return {
        row2: (
          <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">
            {slot} — open full Create Task for more options
          </span>
        ),
        row3: null,
      };
    },
    [
      assignedTeamIds,
      assignedUserId,
      categories,
      chipSuggestions,
      defaultPropertyId,
      dueDate,
      formatDueDateLabel,
      intakeAssetQuery,
      intakeAssetSearchOpen,
      intakeTagQuery,
      intakeTagEditing,
      intakeWhenCustom,
      intakeWhoInviteDraft,
      intakeWhoMode,
      intakeWhoQuery,
      intakeWherePropertyPickerOpen,
      intakeWherePropertyQuery,
      intakeWhereSpaceEditing,
      intakeWhereSpaceQuery,
      members,
      splitName,
      teams,
      whoIntakePersonProposals,
      whoIntakeTeamProposals,
      milestoneDraftDate,
      milestones,
      priority,
      properties,
      repeatPreset,
      propertyId,
      availableAssets,
      selectedProperty,
      selectedAssets,
      selectedAssetIds,
      selectedSpaceIds,
      selectedSpaces,
      selectedThemeIds,
      spaces,
      toast,
      toggleSpaceSelection,
      whenTab,
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
      if (dueDate) {
        const dateObj = new Date(dueDate);
        dueDateValue = dateObj.toISOString();
      }

      const { data: newTask, error } = await supabase
        .from("tasks")
        .insert({
          org_id: orgId,
          title: finalTitle,
          description: description.trim() || null,
          property_id: propertyId || null,
          due_date: dueDateValue,
          milestones:
            milestones.length > 0
              ? milestones.map((milestone) => ({
                  id: milestone.id,
                  dateTime: `${milestone.date}T09:00`,
                }))
              : null,
          priority: priority === "medium" ? "normal" : priority,
          assigned_user_id: assignedUserId || null,
          status: "open",
        })
        .select("id")
        .single();

      if (error) throw error;
      if (!newTask?.id) throw new Error("No task id returned");

      const themeIdsForTask = selectedThemeIds.filter((id) => !id.startsWith("ghost-"));
      if (themeIdsForTask.length > 0) {
        const { error: themeLinkError } = await supabase.from("task_themes").insert(
          themeIdsForTask.map((themeId) => ({ task_id: newTask.id, theme_id: themeId }))
        );
        if (themeLinkError) {
          console.error("[IntakeModal] Error linking themes to task:", themeLinkError);
        }
      }

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

      if (assignedTeamIds.length > 0) {
        const { error: taskTeamsError } = await supabase.from("task_teams").insert(
          assignedTeamIds.map((teamId) => ({ task_id: newTask.id, team_id: teamId }))
        );
        if (taskTeamsError) {
          console.error("[IntakeModal] Error linking teams to task:", taskTeamsError);
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
    setWhenTab("due");
    setMilestones([]);
    setMilestoneDraftDate(format(startOfDay(new Date()), "yyyy-MM-dd"));
    setRepeatPreset("none");
    setPropertyId(defaultPropertyId || "");
    setSelectedSpaceIds([]);
    setSelectedAssetIds([]);
    setPriority("medium");
    setPriorityDefined(false);
    setAssignedUserId(undefined);
    setAssignedTeamIds([]);
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
    setIntakeWhoMode(null);
    setIntakeWhoQuery("");
    setIntakeWherePropertyPickerOpen(false);
    setIntakeWherePropertyQuery("");
    setIntakeWhereSpaceEditing(false);
    setIntakeWhereSpaceQuery("");
    setIntakeWhenCustom(false);
    setIntakeAssetSearchOpen(false);
    setIntakeAssetQuery("");
    setIntakeTagEditing(false);
    setIntakeTagQuery("");
    setSelectedThemeIds([]);
    setTagCreateOpen(false);
    setTagCreateName("");
    setTagCreating(false);
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

  const confirmIntakeTagCreate = useCallback(async () => {
    const name = tagCreateName.trim();
    if (!name || !orgId) return;
    setTagCreating(true);
    try {
      const { data, error } = await supabase
        .from("themes")
        .insert({ org_id: orgId, name, type: "category" })
        .select("id")
        .single();
      if (error) throw error;
      if (data?.id) {
        setSelectedThemeIds((prev) => (prev.includes(data.id) ? prev : [...prev, data.id]));
      }
      await refreshCategories();
      setTagCreateOpen(false);
      setTagCreateName("");
      setIntakeTagQuery("");
      setIntakeTagEditing(false);
      toast({ title: "Tag created" });
    } catch (err: unknown) {
      toast({
        title: "Couldn't create tag",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setTagCreating(false);
    }
  }, [tagCreateName, orgId, refreshCategories, toast]);

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

      <div
        className={cn(
          "flex-1 px-4 py-3 space-y-3 min-h-0",
          variant === "column" && headless ? "overflow-visible" : "overflow-y-auto overscroll-contain"
        )}
      >
          {/* 1. Upload */}
          <ImageUploadSection
            images={images}
            onImagesChange={setImages}
            onPatchImage={patchImage}
            onRunFullIntakeAnalysis={runFullIntakeAnalysis}
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
      <div className="px-4 pt-3 pb-5 border-t border-border/30 space-y-2">
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
      <Dialog open={tagCreateOpen} onOpenChange={setTagCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create tag</DialogTitle>
            <DialogDescription>
              Add &quot;{tagCreateName}&quot; as a new category tag for this task.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              value={tagCreateName}
              onChange={(e) => setTagCreateName(e.target.value)}
              className="h-9 shadow-engraved border-0 bg-input text-sm"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" type="button" onClick={() => setTagCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="shadow-primary-btn"
              onClick={() => void confirmIntakeTagCreate()}
              disabled={tagCreating || !tagCreateName.trim()}
            >
              {tagCreating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
