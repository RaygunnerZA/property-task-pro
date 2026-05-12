/**
 * CreateTaskSections
 *
 * Renders the vertical stack of context panels inside CreateTaskModal:
 * Who → Where → When → Assets → Priority → Category → Compliance
 * plus the Advanced Options block when visible.
 *
 * Pure presentational component — all state comes via props from the modal.
 * Extracted from CreateTaskModal.tsx (Tier 3 — gap-modal-size).
 */

import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { WhoSection } from "./WhoSection";
import { WhenSection, type MilestoneItem } from "./WhenSection";
import { WhereSection } from "./WhereSection";
import { AssetSection } from "./AssetSection";
import { CategorySection } from "./CategorySection";
import { CreateTaskRow } from "./CreateTaskRow";
import { WhoPanel } from "./panels/WhoPanel";
import type { PendingInvitation } from "./tabs/WhoTab";
import type { SubtaskInput } from "./SubtasksSection";
import type { SuggestedChip } from "@/types/chip-suggestions";
import type { TaskPriority, RepeatRule } from "@/types/database";
import type { AIExtractResponse } from "@/hooks/useAIExtract";
import { CREATE_TASK_SECTIONS } from "./createTaskSections";

export interface CreateTaskSectionsProps {
  // Section state
  activeSection: string | null;
  setActiveSection: (s: string | null) => void;
  // Who
  assignedUserId: string | undefined;
  assignedTeamIds: string[];
  setAssignedUserId: (id: string | undefined) => void;
  setAssignedTeamIds: (ids: string[]) => void;
  pendingInvitations: PendingInvitation[];
  setPendingInvitations: React.Dispatch<React.SetStateAction<PendingInvitation[]>>;
  onInviteToOrg: (prefill?: { firstName?: string; lastName?: string; email?: string } | null) => void;
  // Where
  propertyId: string;
  selectedPropertyIds: string[];
  selectedSpaceIds: string[];
  handlePropertyChange: (ids: string[]) => void;
  setSelectedSpaceIds: React.Dispatch<React.SetStateAction<string[]>>;
  defaultPropertyId?: string;
  prefillPropertyId?: string;
  // When
  dueDate: string;
  repeatRule: RepeatRule | undefined;
  milestones: MilestoneItem[];
  setDueDate: (d: string) => void;
  setRepeatRule: (r: RepeatRule | undefined) => void;
  setMilestones: React.Dispatch<React.SetStateAction<MilestoneItem[]>>;
  scheduleConflictNote: string | null;
  // Assets
  selectedAssetIds: string[];
  setSelectedAssetIds: React.Dispatch<React.SetStateAction<string[]>>;
  // Priority
  priority: TaskPriority;
  setPriority: (p: TaskPriority) => void;
  setPriorityTouched: (v: boolean) => void;
  // Categories / Themes
  selectedThemeIds: string[];
  setSelectedThemeIds: React.Dispatch<React.SetStateAction<string[]>>;
  // Compliance
  isCompliance: boolean;
  setIsCompliance: (v: boolean) => void;
  complianceLevel: string;
  setComplianceLevel: (v: string) => void;
  annotationRequired: boolean;
  setAnnotationRequired: (v: boolean) => void;
  showAdvanced: boolean;
  // AI pipeline chips
  unresolvedSections: string[];
  suggestedChipsBySection: Record<string, SuggestedChip[]>;
  factChipsBySection: Record<string, SuggestedChip[]>;
  verbChipsBySection: Record<string, SuggestedChip[]>;
  handleChipSelect: (chip: SuggestedChip) => void;
  handleChipRemove: (chip: SuggestedChip) => void;
  aiResult: AIExtractResponse | null | undefined;
  instructionBlock: { section: string; entityName: string; entityType: string } | null;
  setInstructionBlock: (b: { section: string; entityName: string; entityType: string } | null) => void;
  refreshMembers: () => void;
}

export function CreateTaskSections({
  activeSection,
  setActiveSection,
  assignedUserId,
  assignedTeamIds,
  setAssignedUserId,
  setAssignedTeamIds,
  pendingInvitations,
  setPendingInvitations,
  onInviteToOrg,
  propertyId,
  selectedPropertyIds,
  selectedSpaceIds,
  handlePropertyChange,
  setSelectedSpaceIds,
  defaultPropertyId,
  prefillPropertyId,
  dueDate,
  repeatRule,
  milestones,
  setDueDate,
  setRepeatRule,
  setMilestones,
  scheduleConflictNote,
  selectedAssetIds,
  setSelectedAssetIds,
  priority,
  setPriority,
  setPriorityTouched,
  selectedThemeIds,
  setSelectedThemeIds,
  isCompliance,
  setIsCompliance,
  complianceLevel,
  setComplianceLevel,
  annotationRequired,
  setAnnotationRequired,
  showAdvanced,
  unresolvedSections,
  suggestedChipsBySection,
  factChipsBySection,
  verbChipsBySection,
  handleChipSelect,
  handleChipRemove,
  aiResult,
  instructionBlock,
  setInstructionBlock,
  refreshMembers,
}: CreateTaskSectionsProps) {
  return (
    <div className="space-y-0 flex flex-col mt-0">
      {CREATE_TASK_SECTIONS.map(({ id, instruction, valueLabel, Icon }) =>
        id === "who" ? (
          <WhoSection
            key={id}
            isActive={activeSection === id}
            onActivate={() => setActiveSection(id)}
            assignedUserId={assignedUserId}
            assignedTeamIds={assignedTeamIds}
            onUserChange={setAssignedUserId}
            onTeamsChange={setAssignedTeamIds}
            pendingInvitations={pendingInvitations}
            onPendingInvitationsChange={setPendingInvitations}
            onInviteToOrg={(prefill) => onInviteToOrg(prefill ?? null)}
            onAddAsContractor={() => onInviteToOrg(null)}
            hasUnresolved={unresolvedSections.includes(id)}
            suggestedChips={suggestedChipsBySection["who"] ?? []}
            onSuggestionClick={handleChipSelect}
          >
            {activeSection === id && (
              <WhoPanel
                assignedUserId={assignedUserId}
                assignedTeamIds={assignedTeamIds}
                onUserChange={setAssignedUserId}
                onTeamsChange={setAssignedTeamIds}
                suggestedPeople={aiResult?.people?.map((p) => p.name) ?? []}
                pendingInvitations={pendingInvitations}
                onPendingInvitationsChange={setPendingInvitations}
                instructionBlock={instructionBlock}
                onInstructionDismiss={() => setInstructionBlock(null)}
                onInviteToOrg={(prefill) => onInviteToOrg(prefill ?? null)}
                onAddAsContractor={() => onInviteToOrg(null)}
              />
            )}
          </WhoSection>
        ) : id === "where" ? (
          <WhereSection
            key={id}
            propertyId={propertyId}
            selectedPropertyIds={selectedPropertyIds}
            selectedSpaceIds={selectedSpaceIds}
            onPropertyChange={handlePropertyChange}
            onSpacesChange={setSelectedSpaceIds}
            showFactsByDefault={!!defaultPropertyId || !!prefillPropertyId}
            suggestedChips={suggestedChipsBySection["where"] ?? []}
          />
        ) : id === "when" ? (
          <div key={id} className="space-y-1">
            <WhenSection
              isActive={activeSection === id}
              onActivate={() => setActiveSection(id)}
              onDeactivate={() => setActiveSection(null)}
              dueDate={dueDate}
              repeatRule={repeatRule}
              onDueDateChange={setDueDate}
              onRepeatRuleChange={setRepeatRule}
              milestones={milestones}
              onMilestonesChange={setMilestones}
              hasUnresolved={unresolvedSections.includes(id)}
              suggestedDateLabel={
                (suggestedChipsBySection["when"] ?? []).find((c) => c.type === "date")?.label?.toUpperCase()
              }
              onSuggestedDateAccept={() => {
                const dateChip = (suggestedChipsBySection["when"] ?? []).find((c) => c.type === "date");
                if (dateChip) handleChipSelect(dateChip);
              }}
            />
            {scheduleConflictNote && (
              <div className="pl-8 text-[11px] font-medium text-[#EB6834]">
                {scheduleConflictNote}
              </div>
            )}
          </div>
        ) : id === "what" ? (
          <AssetSection
            key={id}
            isActive={activeSection === id}
            onActivate={() => setActiveSection(id)}
            propertyId={propertyId || undefined}
            spaceId={selectedSpaceIds[0]}
            selectedAssetIds={selectedAssetIds}
            onAssetsChange={setSelectedAssetIds}
            suggestedChips={suggestedChipsBySection["what"] ?? []}
          />
        ) : id === "category" ? (
          <CategorySection
            key={id}
            isActive={activeSection === id}
            onActivate={() => setActiveSection(id)}
            selectedThemeIds={selectedThemeIds}
            onThemesChange={setSelectedThemeIds}
            hasUnresolved={unresolvedSections.includes(id)}
          />
        ) : (
          <CreateTaskRow
            key={id}
            sectionId={id}
            icon={<Icon className="h-4 w-4 text-muted-foreground" />}
            instruction={instruction}
            valueLabel={valueLabel}
            isActive={activeSection === id}
            onActivate={() => setActiveSection(id)}
            factChips={factChipsBySection[id] ?? []}
            suggestedChips={suggestedChipsBySection[id] ?? []}
            verbChips={verbChipsBySection[id] ?? []}
            onChipRemove={handleChipRemove}
            onSuggestionClick={handleChipSelect}
            onVerbChipClick={handleChipSelect}
            hasUnresolved={unresolvedSections.includes(id)}
            hoverChips={
              id === "priority"
                ? [
                    { id: "low", label: "LOW", onPress: () => { setPriorityTouched(true); setPriority("low"); } },
                    { id: "medium", label: "NORMAL", onPress: () => { setPriorityTouched(true); setPriority("medium"); } },
                    { id: "high", label: "HIGH", onPress: () => { setPriorityTouched(true); setPriority("high"); } },
                    { id: "urgent", label: "URGENT", onPress: () => { setPriorityTouched(true); setPriority("urgent"); } },
                  ]
                : undefined
            }
          >
            {activeSection === id && id === "compliance" && (
              <div className="flex items-center gap-2 flex-nowrap overflow-x-auto min-w-0">
                <label className="text-[11px] font-mono uppercase text-muted-foreground">Compliance</label>
                <Switch id="row-compliance" checked={isCompliance} onCheckedChange={setIsCompliance} />
                {isCompliance && (
                  <Select value={complianceLevel} onValueChange={setComplianceLevel}>
                    <SelectTrigger className="h-8 w-auto min-w-[100px] text-[11px] font-mono">
                      <SelectValue placeholder="Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </CreateTaskRow>
        )
      )}

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="space-y-4 p-4 rounded-[8px] bg-muted/50 shadow-engraved">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="compliance" className="text-sm">Compliance Task</Label>
              <p className="text-xs text-muted-foreground">Mark as regulatory requirement</p>
            </div>
            <Switch id="compliance" checked={isCompliance} onCheckedChange={setIsCompliance} />
          </div>
          {isCompliance && (
            <div className="space-y-2">
              <Label className="text-xs">Compliance Level</Label>
              <Select value={complianceLevel} onValueChange={setComplianceLevel}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="annotation" className="text-sm">Requires Photo Annotation</Label>
              <p className="text-xs text-muted-foreground">Enforce photo markup on completion</p>
            </div>
            <Switch id="annotation" checked={annotationRequired} onCheckedChange={setAnnotationRequired} />
          </div>
        </div>
      )}
    </div>
  );
}
