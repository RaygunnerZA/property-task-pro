/**
 * useCreateTaskAIPipeline
 *
 * Owns all AI extraction and chip-resolution logic for CreateTaskModal:
 *  - Image analysis (OCR + object detection via useImageAnalysis)
 *  - AI field extraction (useAIExtract — title, date, priority, signature)
 *  - Chip suggestions (useChipSuggestions)
 *  - Applied/selected chip state and resolution pipeline
 *  - Clarity + instruction-block state
 *  - Title-field visibility state driven by AI output
 *
 * Cross-cutting side-effects (writing form fields like dueDate, priority, title)
 * are performed via the setter callbacks passed as props so this hook stays pure
 * from the form's perspective.
 *
 * Extracted from CreateTaskModal.tsx (Tier 3 — t3-modal).
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAIExtract } from "@/hooks/useAIExtract";
import { useChipSuggestions } from "@/hooks/useChipSuggestions";
import { useImageAnalysis } from "@/hooks/useImageAnalysis";
import { resolveChip, type AvailableEntities } from "@/services/ai/resolutionPipeline";
import { logChipResolution } from "@/services/ai/resolutionAudit";
import type { SuggestedChip, ChipType } from "@/types/chip-suggestions";
import type { TempImage, ImageAnalysisResult } from "@/types/temp-image";
import { supabase } from "@/integrations/supabase/client";
import type { ClaritySeverity } from "./ClarityState";
import type { TaskPriority } from "@/types/database";

// ─── Section metadata (duplicated here to avoid importing from JSX) ──────────

const CHIP_TYPE_TO_SECTION: Record<string, string> = {
  person: "who",
  team: "who",
  space: "where",
  asset: "what",
  date: "when",
  recurrence: "when",
  priority: "priority",
  category: "category",
  theme: "category",
  compliance: "compliance",
};

const FACT_CHIP_TYPES: ChipType[] = ["person", "team", "space", "asset", "category", "date", "recurrence"];

// ─── Public interface ─────────────────────────────────────────────────────────

export interface UseCreateTaskAIPipelineProps {
  // Form field values (read-only from pipeline's perspective)
  description: string;
  title: string;
  propertyId: string;
  selectedSpaceIds: string[];
  assignedUserId?: string;
  assignedTeamIds: string[];
  // Image state (pipeline needs to read AND mutate images)
  images: TempImage[];
  setImages: React.Dispatch<React.SetStateAction<TempImage[]>>;
  // External entity data for resolution
  orgId: string | null;
  spaces: Array<{ id: string; name: string; property_id: string }>;
  members: Array<{ id: string; user_id: string; display_name: string }>;
  teams: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; parent_id?: string }>;
  // Cross-cutting form setters
  setDueDate: (date: string) => void;
  setPriority: (p: TaskPriority) => void;
  setPriorityTouched: (v: boolean) => void;
  setTitle: (t: string) => void;
  setActiveSection: (s: string | null) => void;
  setIsCompliance: (v: boolean) => void;
  setShowAdvanced: (v: boolean) => void;
  // Modal lifecycle
  open: boolean;
  priority: TaskPriority;
  priorityTouched: boolean;
  dueDate: string;
}

export function useCreateTaskAIPipeline({
  description,
  title,
  propertyId,
  selectedSpaceIds,
  assignedUserId,
  assignedTeamIds,
  images,
  setImages,
  orgId,
  spaces,
  members,
  teams,
  categories,
  setDueDate,
  setPriority,
  setPriorityTouched,
  setTitle,
  setActiveSection,
  setIsCompliance,
  setShowAdvanced,
  open,
  priority,
  priorityTouched,
  dueDate,
}: UseCreateTaskAIPipelineProps) {
  // ─── Title-field visibility state (AI-driven) ─────────────────────────────

  const [aiTitleGenerated, setAiTitleGenerated] = useState("");
  const [userEditedTitle, setUserEditedTitle] = useState(false);
  const [showTitleField, setShowTitleField] = useState(false);

  // ─── Chip resolution state ────────────────────────────────────────────────

  const [appliedChips, setAppliedChips] = useState<Map<string, SuggestedChip>>(new Map());
  const [selectedChipIds, setSelectedChipIds] = useState<string[]>([]);

  // ─── Clarity + instruction block state ───────────────────────────────────

  const [clarityState, setClarityState] = useState<{
    severity: ClaritySeverity;
    message: string;
  } | null>(null);

  const [instructionBlock, setInstructionBlock] = useState<{
    section: string;
    entityName: string;
    entityType: string;
  } | null>(null);

  // ─── Image analysis ───────────────────────────────────────────────────────

  const patchImage = useCallback(
    (localId: string, patch: Partial<TempImage>) => {
      setImages((prev) => prev.map((img) => (img.local_id === localId ? { ...img, ...patch } : img)));
    },
    [setImages]
  );

  const handleAnalysisComplete = useCallback(
    (localId: string, result: ImageAnalysisResult) => {
      setImages((prev) =>
        prev.map((img) => {
          if (img.local_id !== localId) return img;
          const meta = { ...(result.metadata ?? {}) };
          meta.intake_stage = meta.router_mode === true ? "router" : "full";
          return {
            ...img,
            aiOcrText: result.ocr_text ?? "",
            detectedLabels: result.detected_labels ?? [],
            rawAnalysis: { ...result, metadata: meta },
          };
        })
      );
    },
    [setImages]
  );

  const { imageOcrText, detectedLabels, runFullIntakeAnalysis } = useImageAnalysis({
    images,
    propertyId: propertyId || undefined,
    orgId: orgId ?? "",
    onAnalysisComplete: handleAnalysisComplete,
    onPatchImage: patchImage,
  });

  const { combinedImageText, detectedObjects } = useMemo(() => {
    const parts = [imageOcrText, detectedLabels.join(" ")].filter(Boolean);
    const text = parts.join("\n");
    const objects = images.flatMap((img) =>
      (img.rawAnalysis?.detected_objects ?? []).map((o) => ({
        type: o.type,
        label: o.label,
        confidence: o.confidence,
        serial_number: o.serial_number,
        expiry_date: o.expiry_date,
      }))
    );
    return { combinedImageText: text, detectedObjects: objects };
  }, [imageOcrText, detectedLabels, images]);

  // ─── AI text extraction ───────────────────────────────────────────────────

  const { result: aiResult, loading: aiLoading, error: aiError } = useAIExtract(description);

  // ─── Chip suggestions ─────────────────────────────────────────────────────

  const {
    chips: chipSuggestions,
    ghostCategories,
    suggestedIcon: chipSuggestedIcon,
    loading: chipsLoading,
    error: chipsError,
  } = useChipSuggestions({
    description,
    propertyId,
    selectedSpaceIds,
    selectedPersonId: assignedUserId,
    selectedTeamIds: assignedTeamIds,
    imageOcrText: combinedImageText,
    detectedLabels,
    detectedObjects,
  });

  // ─── Auto-apply date chips from rule-based extractor ─────────────────────

  useEffect(() => {
    if (dueDate) return;
    const dateChip = chipSuggestions.find((c) => c.type === "date" && c.resolvedEntityId);
    if (dateChip?.resolvedEntityId) setDueDate(dateChip.resolvedEntityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chipSuggestions]);

  // ─── Derived chip arrays ──────────────────────────────────────────────────

  const factChips = useMemo(() => {
    const chipMap = new Map<string, SuggestedChip>();
    chipSuggestions
      .filter((c) => FACT_CHIP_TYPES.includes(c.type) && c.type !== "date")
      .forEach((c) => chipMap.set(c.id, c));
    Array.from(appliedChips.values())
      .filter((c) => FACT_CHIP_TYPES.includes(c.type))
      .forEach((c) => chipMap.set(c.id, c));
    return Array.from(chipMap.values()).filter((c) => c.resolvedEntityId || !c.blockingRequired);
  }, [chipSuggestions, appliedChips]);

  const verbChips = useMemo(() => {
    const chipMap = new Map<string, SuggestedChip>();
    Array.from(appliedChips.values())
      .filter((c) => FACT_CHIP_TYPES.includes(c.type))
      .forEach((c) => chipMap.set(c.id, c));
    return Array.from(chipMap.values()).filter((c) => c.blockingRequired && !c.resolvedEntityId);
  }, [appliedChips]);

  const unresolvedSections = useMemo(() => {
    const unresolved: string[] = [];
    verbChips.forEach((chip) => {
      const section = CHIP_TYPE_TO_SECTION[chip.type];
      if (section && !unresolved.includes(section)) unresolved.push(section);
    });
    return unresolved;
  }, [verbChips]);

  const generateVerbLabel = useCallback((chip: SuggestedChip): string => {
    const value = chip.value || chip.label;
    switch (chip.type) {
      case "person": return `INVITE ${value.toUpperCase()}`;
      case "team": return `CHOOSE ${value.toUpperCase()}`;
      case "space": return `ADD ${value.toUpperCase()}`;
      case "asset": return `ADD ${value.toUpperCase()}`;
      case "category": return `CHOOSE ${value.toUpperCase()}`;
      case "date": return `SET ${value.toUpperCase()}`;
      default: return `CHOOSE ${value.toUpperCase()}`;
    }
  }, []);

  const CREATE_TASK_SECTIONS_IDS = useMemo(
    () => ["who", "where", "when", "what", "priority", "category", "compliance"] as const,
    []
  );

  const factChipsBySection = useMemo(() => {
    const bySection: Record<string, SuggestedChip[]> = {};
    CREATE_TASK_SECTIONS_IDS.forEach((s) => { bySection[s] = []; });
    factChips.forEach((chip) => {
      const section = CHIP_TYPE_TO_SECTION[chip.type];
      if (section && bySection[section]) bySection[section].push(chip);
    });
    if (priorityTouched) {
      const priorityLabel = { low: "LOW", medium: "NORMAL", high: "HIGH", urgent: "URGENT" }[priority];
      bySection["priority"] = [
        { id: `priority-${priority}`, type: "priority", value: priority, label: priorityLabel, score: 1, source: "rule", resolvedEntityId: priority },
      ];
    } else {
      bySection["priority"] = [];
    }
    return bySection;
  }, [factChips, CREATE_TASK_SECTIONS_IDS, priority, priorityTouched]);

  const suggestedChipsBySection = useMemo(() => {
    const bySection: Record<string, SuggestedChip[]> = {};
    CREATE_TASK_SECTIONS_IDS.forEach((s) => { bySection[s] = []; });
    const factIds = new Set(factChips.map((c) => c.id));
    const verbIds = new Set(verbChips.map((c) => c.id));
    chipSuggestions.forEach((chip) => {
      const section = CHIP_TYPE_TO_SECTION[chip.type];
      if (section && bySection[section] && !factIds.has(chip.id) && !verbIds.has(chip.id)) {
        bySection[section].push(chip);
      }
    });
    return bySection;
  }, [chipSuggestions, factChips, verbChips, CREATE_TASK_SECTIONS_IDS]);

  const verbChipsBySection = useMemo(() => {
    const bySection: Record<string, SuggestedChip[]> = {};
    CREATE_TASK_SECTIONS_IDS.forEach((s) => { bySection[s] = []; });
    verbChips.forEach((chip) => {
      const section = CHIP_TYPE_TO_SECTION[chip.type];
      if (section && bySection[section]) {
        bySection[section].push({ ...chip, label: generateVerbLabel(chip) });
      }
    });
    return bySection;
  }, [verbChips, CREATE_TASK_SECTIONS_IDS, generateVerbLabel]);

  // ─── Clarity state updater ────────────────────────────────────────────────

  useEffect(() => {
    const blockingIssues: string[] = [];
    const warningIssues: string[] = [];

    appliedChips.forEach((chip) => {
      if (chip.blockingRequired && !chip.resolvedEntityId) {
        if (chip.type === "space" && !propertyId) {
          blockingIssues.push(`"${chip.label}" was found, but no property is selected. Which property does this apply to?`);
        } else if (chip.type === "asset" && !propertyId) {
          blockingIssues.push(`"${chip.label}" needs a property. Pick one to continue.`);
        } else if (chip.type === "person") {
          blockingIssues.push(`Invite "${chip.label}" to assign this task, or choose an existing contact.`);
        } else {
          blockingIssues.push(`"${chip.label}" needs sorting before creating this task.`);
        }
      }
    });

    const hasSpaceOrAssetChips = Array.from(appliedChips.values()).some(
      (c) => (c.type === "space" || c.type === "asset") && !c.resolvedEntityId
    );
    if (hasSpaceOrAssetChips && !propertyId) {
      blockingIssues.push("Pick a property when adding spaces or assets.");
    }

    if (blockingIssues.length > 0) {
      setClarityState({ severity: "blocking", message: `Resolve before creating. ${blockingIssues[0]}` });
    } else if (warningIssues.length > 0) {
      setClarityState({ severity: "warning", message: warningIssues[0] });
    } else {
      setClarityState(null);
    }
  }, [appliedChips, propertyId]);

  // ─── AI auto-apply effects ────────────────────────────────────────────────

  useEffect(() => {
    if (aiResult?.title && !userEditedTitle) {
      let processed = aiResult.title.trim();
      if (processed.length >= 3) {
        processed = processed.charAt(0).toUpperCase() + processed.slice(1);
        processed = processed.replace(/[.!]+$/, "");
        setAiTitleGenerated(processed);
        setTitle(processed);
        setShowTitleField(true);
      }
    }
  }, [aiResult?.title, userEditedTitle, setTitle]);

  useEffect(() => {
    if (!aiResult) return;
    if (aiResult.priority === "HIGH" || aiResult.priority === "high") {
      setPriority("high"); setPriorityTouched(true);
    } else if (aiResult.priority === "URGENT" || aiResult.priority === "urgent") {
      setPriority("urgent"); setPriorityTouched(true);
    } else if (aiResult.priority === "MEDIUM" || aiResult.priority === "medium") {
      setPriority("medium"); setPriorityTouched(false);
    } else if (aiResult.priority === "LOW" || aiResult.priority === "low") {
      setPriority("low"); setPriorityTouched(true);
    }

    if (aiResult.date) {
      const today = new Date();
      const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      if (aiResult.date === "today") {
        setDueDate(today.toISOString().split("T")[0]);
      } else if (aiResult.date === "tomorrow") {
        today.setDate(today.getDate() + 1);
        setDueDate(today.toISOString().split("T")[0]);
      } else if (aiResult.date === "next_week") {
        today.setDate(today.getDate() + 7);
        setDueDate(today.toISOString().split("T")[0]);
      } else if (weekdays.includes(aiResult.date.toLowerCase())) {
        const targetDay = weekdays.indexOf(aiResult.date.toLowerCase());
        const currentDay = today.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7;
        today.setDate(today.getDate() + daysToAdd);
        setDueDate(today.toISOString().split("T")[0]);
      }
    }

    if (aiResult.signature) {
      setIsCompliance(true);
      setShowAdvanced(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiResult]);

  useEffect(() => {
    if (!description.trim()) {
      setShowTitleField(false);
      setUserEditedTitle(false);
      if (!userEditedTitle && !aiTitleGenerated) setTitle("");
    } else {
      if (aiTitleGenerated && !userEditedTitle && !title.trim()) {
        setTitle(aiTitleGenerated);
        setShowTitleField(true);
      } else if (title.trim() && !showTitleField) {
        setShowTitleField(true);
      }
    }
  }, [description, userEditedTitle, aiTitleGenerated, title, showTitleField, setTitle]);

  // ─── Reset on modal close ─────────────────────────────────────────────────

  useEffect(() => {
    if (!open) {
      setAppliedChips(new Map());
      setSelectedChipIds([]);
      setAiTitleGenerated("");
      setUserEditedTitle(false);
      setShowTitleField(false);
      setClarityState(null);
      setInstructionBlock(null);
    }
  }, [open]);

  // ─── Chip handlers ────────────────────────────────────────────────────────

  const handleChipRemove = useCallback(
    (chip: SuggestedChip) => {
      if (chip.type === "priority") {
        setPriority("medium");
        setPriorityTouched(false);
        return;
      }
      const updated = new Map(appliedChips);
      updated.delete(chip.id);
      setAppliedChips(updated);
      setSelectedChipIds((prev) => prev.filter((id) => id !== chip.id));
    },
    [appliedChips, setPriority, setPriorityTouched]
  );

  const handleChipSelect = useCallback(
    async (chip: SuggestedChip) => {
      const isCurrentlySelected = selectedChipIds.includes(chip.id);
      const section = CHIP_TYPE_TO_SECTION[chip.type];
      if (section) {
        setActiveSection(section);
        setTimeout(() => {
          document.getElementById(`context-panel-${section}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 100);
      }

      if (isCurrentlySelected) {
        setSelectedChipIds((prev) => prev.filter((id) => id !== chip.id));
        const updated = new Map(appliedChips);
        updated.delete(chip.id);
        setAppliedChips(updated);
        return;
      }

      setSelectedChipIds((prev) => [...prev, chip.id]);

      if (!orgId) return;

      let assets: Array<{ id: string; name: string; property_id: string; space_id?: string }> = [];
      if (chip.type === "asset" && propertyId) {
        try {
          const { data } = await supabase
            .from("assets")
            .select("id, name, property_id, space_id")
            .eq("org_id", orgId)
            .eq("property_id", propertyId);
          assets = (data ?? []).map((a) => ({
            id: a.id,
            name: a.name || "",
            property_id: a.property_id,
            space_id: a.space_id ?? undefined,
          }));
        } catch (err) {
          console.error("Error loading assets for chip resolution:", err);
        }
      }

      const entities: AvailableEntities = {
        spaces: spaces.map((s) => ({ id: s.id, name: s.name, property_id: s.property_id })),
        members: members.map((m) => ({ id: m.id, user_id: m.user_id, display_name: m.display_name })),
        teams: teams.map((t) => ({ id: t.id, name: t.name ?? "" })),
        assets,
        categories: categories.map((c) => ({ id: c.id, name: c.name, parent_id: c.parent_id })),
        properties: [],
      };

      const resolution = await resolveChip(chip, entities, {
        propertyId,
        spaceId: selectedSpaceIds[0],
        orgId,
      });

      const resolvedChip: SuggestedChip = {
        ...chip,
        state: resolution.resolved ? "resolved" : resolution.requiresCreation ? "blocked" : "applied",
        resolvedEntityId: resolution.entityId,
        resolvedEntityType: resolution.entityType,
        resolutionSource: resolution.resolutionSource,
        resolutionConfidence: resolution.confidence,
        blockingRequired: chip.type === "space" || chip.type === "asset" || chip.type === "person",
      };

      const updated = new Map(appliedChips);
      updated.set(chip.id, resolvedChip);
      setAppliedChips(updated);

      if (orgId && resolution.resolved) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            await logChipResolution(
              orgId,
              user.id,
              { chip: chip.label, type: chip.type },
              { resolved: resolution.resolved, entityId: resolution.entityId }
            );
          }
        } catch (err) {
          console.error("Error logging chip resolution:", err);
        }
      }

      if (chip.type === "date" && chip.resolvedEntityId) {
        setDueDate(chip.resolvedEntityId);
      }

      if (chip.type === "asset" && !propertyId) {
        setActiveSection("where");
      } else if (chip.type === "asset" && propertyId && selectedSpaceIds.length === 0) {
        setActiveSection("where");
      }
    },
    [selectedChipIds, appliedChips, orgId, spaces, members, teams, categories, propertyId, selectedSpaceIds, setActiveSection, setDueDate]
  );

  // ─── Derived convenience flags ────────────────────────────────────────────

  const hasDescriptionDraft = Boolean(description.trim());
  const shouldShowTitleField = hasDescriptionDraft && (showTitleField || aiLoading || Boolean(aiError) || Boolean(title.trim()));

  return {
    // Image analysis
    patchImage,
    runFullIntakeAnalysis,
    imageOcrText,
    detectedLabels,
    // AI extraction
    aiResult,
    aiLoading,
    aiError,
    // Chip suggestions
    chipSuggestions,
    ghostCategories,
    chipSuggestedIcon,
    chipsLoading,
    chipsError,
    // Chip state
    appliedChips,
    setAppliedChips,
    selectedChipIds,
    setSelectedChipIds,
    // Derived chip arrays
    factChips,
    verbChips,
    unresolvedSections,
    factChipsBySection,
    suggestedChipsBySection,
    verbChipsBySection,
    // Clarity + instruction
    clarityState,
    instructionBlock,
    setInstructionBlock,
    // Title field state
    aiTitleGenerated,
    userEditedTitle,
    setUserEditedTitle,
    showTitleField,
    setShowTitleField,
    hasDescriptionDraft,
    shouldShowTitleField,
    // Helpers (used in handleSubmit)
    generateVerbLabel,
    // Handlers
    handleChipRemove,
    handleChipSelect,
  };
}
