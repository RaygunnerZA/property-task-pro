import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import { FillaIcon } from "@/components/filla/FillaIcon";
import { SubtasksSection } from "./create/SubtasksSection";
import { ImageUploadSection } from "./create/ImageUploadSection";
import type { TaskCreatedSource } from "@/hooks/mutations/useCreateTaskMutation";
import { useCreateTaskForm } from "./create/useCreateTaskForm";
import { useCreateTaskAIPipeline } from "./create/useCreateTaskAIPipeline";
import { useCreateTaskSubmit } from "./create/useCreateTaskSubmit";
import { CreateTaskSections } from "./create/CreateTaskSections.tsx";
import { CreateTaskFooter } from "./create/CreateTaskFooter";
import { CreateTaskDialogs } from "./create/CreateTaskDialogs";

export type { TaskCreatedSource };
export interface CreateTaskPrefill {
  title?: string;
  description?: string;
  dueDate?: string;
  propertyId?: string;
  spaceIds?: string[];
  assetIds?: string[];
  category?: string;
}

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: (taskId: string) => void;
  defaultPropertyId?: string;
  /** If true, auto-select the last used property when no default/prefill is provided. */
  prefillFromLastUsedProperty?: boolean;
  defaultDueDate?: string;
  defaultSpaceIds?: string[];
  defaultAssetIds?: string[];
  prefill?: CreateTaskPrefill | null;
  /** Overrides inferred `task_created` analytics source (default: `ai` if `prefill` set, else `manual`). */
  taskCreatedSource?: TaskCreatedSource;
  variant?: "modal" | "column"; // "modal" for mobile overlay, "column" for desktop third column
  headless?: boolean; // when true with variant="column", render only content (concertina provides header)
  collapseDetails?: boolean; // keeps top composer visible while hiding lower sections/actions
}

export function CreateTaskModal({
  open,
  onOpenChange,
  onTaskCreated,
  defaultPropertyId,
  prefillFromLastUsedProperty = true,
  defaultDueDate,
  defaultSpaceIds,
  defaultAssetIds,
  prefill,
  taskCreatedSource,
  variant = "modal",
  headless = false,
  collapseDetails = false,
}: CreateTaskModalProps) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const isMobile = useIsMobile();

  // ─── Form state (extracted to useCreateTaskForm) ─────────────────────────

  const {
    members,
    refreshMembers,
    templates,
    spaces,
    teams,
    categories,
    activeTemplate,
    scheduleConflictNote,
    title, setTitle,
    description, setDescription,
    propertyId,
    selectedPropertyIds,
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
    setTemplateId,
    recentTemplateIds,
    templateDialogMode, setTemplateDialogMode,
    templateDraftName, setTemplateDraftName,
    templateDraftCategory, setTemplateDraftCategory,
    subtasks, setSubtasks,
    selectedThemeIds, setSelectedThemeIds,
    selectedAssetIds, setSelectedAssetIds,
    images, setImages,
    taskFiles, setTaskFiles,
    showAdvanced,
    setShowAdvanced,
    activeSection, setActiveSection,
    inviteModalOpen, setInviteModalOpen,
    invitePrefill, setInvitePrefill,
    pendingTemplateImport, setPendingTemplateImport,
    showArchiveTemplateDialog, setShowArchiveTemplateDialog,
    handlePropertyChange,
    rememberRecentTemplate,
    importTemplateItems,
    importStarterPreset,
    openTemplateDialog,
    submitTemplateDialog,
    archiveActiveTemplate,
    confirmArchiveTemplate,
    resetForm,
  } = useCreateTaskForm({
    open,
    defaultPropertyId,
    prefillFromLastUsedProperty,
    defaultDueDate,
    defaultSpaceIds,
    defaultAssetIds,
    prefill,
  });

  // ─── AI pipeline (extracted to useCreateTaskAIPipeline) ──────────────────

  const {
    patchImage,
    runFullIntakeAnalysis,
    aiResult,
    aiLoading,
    aiError,
    chipSuggestedIcon,
    appliedChips,
    verbChips,
    unresolvedSections,
    factChipsBySection,
    suggestedChipsBySection,
    verbChipsBySection,
    clarityState,
    instructionBlock,
    setInstructionBlock,
    aiTitleGenerated,
    setUserEditedTitle,
    shouldShowTitleField,
    handleChipRemove,
    handleChipSelect,
    generateVerbLabel,
  } = useCreateTaskAIPipeline({
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
  });

  // ─── Submit pipeline (extracted to useCreateTaskSubmit) ──────────────────

  const { handleSubmit, isSubmitting } = useCreateTaskSubmit({
    orgId,
    orgLoading,
    title,
    description,
    propertyId,
    selectedPropertyIds,
    selectedSpaceIds,
    selectedThemeIds,
    selectedAssetIds,
    priority,
    dueDate,
    milestones,
    assignedUserId,
    assignedTeamIds,
    pendingInvitations,
    images,
    taskFiles,
    subtasks,
    appliedChips,
    aiTitleGenerated,
    chipSuggestedIcon,
    generateVerbLabel,
    prefill,
    taskCreatedSource,
    resetForm,
    onOpenChange,
    onTaskCreated,
  });

  // Description being non-empty and not collapsed controls the expanded view
  const shouldShowDetailsArea = Boolean(description.trim()) && !collapseDetails;

  const content = <div className="flex flex-col h-full max-h-[85vh]">
      {/* Header - only show for modal variant */}
      {variant !== "column" && (
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Create Task
          </h2>
          <button 
            type="button"
            onClick={() => onOpenChange(false)} 
            className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Scrollable Content - Vertical Layout */}
      <div className="flex-1 overflow-y-auto p-4 pb-0 space-y-6">
        {/* Image Upload Icons */}
        <ImageUploadSection
          images={images}
          onImagesChange={setImages}
          onPatchImage={patchImage}
          onRunFullIntakeAnalysis={runFullIntakeAnalysis}
          files={taskFiles}
          onFilesChange={setTaskFiles}
          taskId={undefined}
        />

        {/* AI-Generated Title (collapses until user starts description) */}
        <div
          className={cn(
            "rounded-none transition-all duration-300 ease-out overflow-hidden",
            shouldShowTitleField ? "!mt-2 max-h-28 opacity-100" : "!mt-3 max-h-0 opacity-0 pointer-events-none"
          )}
        >
          <div className="relative">
            <FillaIcon size={12} className="text-primary absolute left-1.5 top-1.5 pointer-events-none text-left" />
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setUserEditedTitle(true);
                setTitle(e.target.value);
                if (e.target.value.trim() === "") {
                  setUserEditedTitle(false);
                }
              }}
              className="w-full h-10 pl-[22px] pr-4 py-3 rounded-[8px] bg-input shadow-engraved focus:outline-none focus:ring-2 focus:ring-primary/30 font-sans text-sm transition-shadow"
              placeholder="Generated title…"
            />
          </div>
          {!aiLoading && aiError && !aiResult?.title && (
            <p className="pt-2 text-[10px] text-muted-foreground">
              AI title is temporarily unavailable. You can still enter one manually.
            </p>
          )}
        </div>

        {/* Description: 12px below upload when title hidden; 8px below AI title when visible */}
        <div className={cn(shouldShowTitleField ? "!mt-2" : "!mt-0")}>
          <SubtasksSection
            subtasks={subtasks}
            onSubtasksChange={setSubtasks}
            description={description}
            onDescriptionChange={setDescription}
            className="bg-transparent"
          templates={templates}
          recentTemplateIds={recentTemplateIds}
          activeTemplateName={activeTemplate?.name ?? null}
          onUseTemplate={importTemplateItems}
          onUseStarterPreset={importStarterPreset}
          onSaveAsTemplate={() => openTemplateDialog("save")}
          onEditTemplate={() => openTemplateDialog("edit")}
          onDuplicateTemplate={() => openTemplateDialog("duplicate")}
          onArchiveTemplate={archiveActiveTemplate}
        />
        </div>

        <div
          aria-hidden={!shouldShowDetailsArea}
          className={cn(
            "grid !mt-0 pt-[5px] transition-[grid-template-rows,opacity] duration-500 ease-out",
            shouldShowDetailsArea
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0 pointer-events-none"
          )}
        >
        <div className="overflow-hidden">
          <CreateTaskSections
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            assignedUserId={assignedUserId}
            assignedTeamIds={assignedTeamIds}
            setAssignedUserId={setAssignedUserId}
            setAssignedTeamIds={setAssignedTeamIds}
            pendingInvitations={pendingInvitations}
            setPendingInvitations={setPendingInvitations}
            onInviteToOrg={(p) => { setInvitePrefill(p ?? null); setInviteModalOpen(true); }}
            propertyId={propertyId}
            selectedPropertyIds={selectedPropertyIds}
            selectedSpaceIds={selectedSpaceIds}
            handlePropertyChange={handlePropertyChange}
            setSelectedSpaceIds={setSelectedSpaceIds}
            defaultPropertyId={defaultPropertyId}
            prefillPropertyId={prefill?.propertyId}
            dueDate={dueDate}
            repeatRule={repeatRule}
            milestones={milestones}
            setDueDate={setDueDate}
            setRepeatRule={setRepeatRule}
            setMilestones={setMilestones}
            scheduleConflictNote={scheduleConflictNote}
            selectedAssetIds={selectedAssetIds}
            setSelectedAssetIds={setSelectedAssetIds}
            priority={priority}
            setPriority={setPriority}
            setPriorityTouched={setPriorityTouched}
            selectedThemeIds={selectedThemeIds}
            setSelectedThemeIds={setSelectedThemeIds}
            isCompliance={isCompliance}
            setIsCompliance={setIsCompliance}
            complianceLevel={complianceLevel}
            setComplianceLevel={setComplianceLevel}
            annotationRequired={annotationRequired}
            setAnnotationRequired={setAnnotationRequired}
            showAdvanced={showAdvanced}
            unresolvedSections={unresolvedSections}
            suggestedChipsBySection={suggestedChipsBySection}
            factChipsBySection={factChipsBySection}
            verbChipsBySection={verbChipsBySection}
            handleChipSelect={handleChipSelect}
            handleChipRemove={handleChipRemove}
            aiResult={aiResult}
            instructionBlock={instructionBlock}
            setInstructionBlock={setInstructionBlock}
            refreshMembers={refreshMembers}
          />
        </div>
        </div>{/* end overflow-hidden */}
      </div>{/* end grid-rows animation */}

      <CreateTaskFooter
        clarityState={clarityState}
        verbChips={verbChips}
        isSubmitting={isSubmitting}
        shouldShowDetailsArea={shouldShowDetailsArea}
        handleSubmit={handleSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </div>;

  const dialogs = (
    <CreateTaskDialogs
      inviteModalOpen={inviteModalOpen}
      setInviteModalOpen={setInviteModalOpen}
      invitePrefill={invitePrefill}
      setInvitePrefill={setInvitePrefill}
      setAssignedUserId={setAssignedUserId}
      setPendingInvitations={setPendingInvitations}
      refreshMembers={refreshMembers}
      templateDialogMode={templateDialogMode}
      setTemplateDialogMode={setTemplateDialogMode}
      templateDraftName={templateDraftName}
      setTemplateDraftName={setTemplateDraftName}
      templateDraftCategory={templateDraftCategory}
      setTemplateDraftCategory={setTemplateDraftCategory}
      submitTemplateDialog={submitTemplateDialog}
      pendingTemplateImport={pendingTemplateImport}
      setPendingTemplateImport={setPendingTemplateImport}
      setTemplateId={setTemplateId}
      setSubtasks={setSubtasks}
      rememberRecentTemplate={rememberRecentTemplate}
      showArchiveTemplateDialog={showArchiveTemplateDialog}
      setShowArchiveTemplateDialog={setShowArchiveTemplateDialog}
      activeTemplateName={activeTemplate?.name ?? null}
      confirmArchiveTemplate={confirmArchiveTemplate}
    />
  );

  if (variant === "column" && headless) {
    return <>{content}{dialogs}</>;
  }

  if (variant === "column") {
    const accordionBodyId = "create-task-accordion-body";
    const isExpanded = open;
    return (
      <>
        <div
          className="h-auto flex flex-col bg-background rounded-[12px] shadow-[2px_4px_6px_0px_rgba(0,0,0,0.15),inset_1px_1px_2px_0px_rgba(255,255,255,1),inset_-1px_-1px_2px_0px_rgba(0,0,0,0.25)] border-0 relative overflow-hidden"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise-filter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.522\' numOctaves=\'1\' stitchTiles=\'stitch\'%3E%3C/feTurbulence%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'%3E%3C/feColorMatrix%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'0.468\'%3E%3C/feFuncR%3E%3CfeFuncG type=\'linear\' slope=\'0.468\'%3E%3C/feFuncG%3E%3CfeFuncB type=\'linear\' slope=\'0.468\'%3E%3C/feFuncB%3E%3CfeFuncA type=\'linear\' slope=\'0.137\'%3E%3C/feFuncA%3E%3C/feComponentTransfer%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncG type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncB type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise-filter)\' opacity=\'0.8\'%3E%3C/rect%3E%3C/svg%3E")', backgroundSize: "100%" }}
        >
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={accordionBodyId}
            onClick={() => onOpenChange(!isExpanded)}
            className={cn(
              "px-4 pt-4 pb-4 border-b border-border/30 w-full text-left",
              "flex items-center justify-between gap-3",
              "bg-[#85BABC] transition-colors hover:bg-[#85BABC]",
              "rounded-t-[12px] shadow-[inset_-2px_-2px_3px_-2px_rgba(0,0,0,0.3),inset_2px_3px_2.5px_0px_rgba(255,255,255,0.4)]"
            )}
          >
            <h2 className="text-lg font-semibold text-white">Create Task</h2>
            {isExpanded ? <ChevronUp className="h-5 w-5 text-white" /> : <ChevronDown className="h-5 w-5 text-white" />}
          </button>
          <div
            id={accordionBodyId}
            className={cn(
              "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out",
              isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
            )}
          >
            {content}
          </div>
        </div>
        {dialogs}
      </>
    );
  }

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[95vh]">{content}</DrawerContent>
        </Drawer>
        {dialogs}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent hideCloseButton className="max-h-[95vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>Create a new task with details, assignments, and metadata</DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
      {dialogs}
    </>
  );
}