import { mapTask } from "../utils/mapTask";
import { cn } from "@/lib/utils";
import { Calendar, Check, ChevronRight, Clock, MapPin, MessageSquare, MoreHorizontal } from "lucide-react";
import {
  COMPLETE_COLLAPSE_MS,
  clearTaskCompletionMotion,
  playTaskCompletionMotion,
  useTaskCompletionMotion,
} from "@/lib/taskCompletionMotion";
import { getPropertyChipIcon } from "@/lib/propertyChipIcons";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { markTaskCompleted } from "@/lib/completeTask";
import { archiveTask } from "@/services/tasks/taskMutations";
import { useDeleteTaskMutation } from "@/hooks/mutations/useDeleteTaskMutation";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useCallback, memo, type MouseEvent, type ReactNode } from "react";
import { formatTaskDate } from "@/utils/formatTaskDate";
import { formatMessageDayLabel } from "@/lib/formatMessageDayLabel";
import { isOnboardingDemoTask } from "@/lib/onboardingEducation";
import { isStaffTrainingTask } from "@/lib/staffTraining";
import {
  UserAvatar,
  TASK_CARD_AVATAR_SIZE,
  TASK_CARD_META_CHIP_SIZE,
} from "@/components/tasks/UserAvatar";
import type { TaskMessagePreview } from "@/hooks/useTaskMessageActivity";
import { resolveTaskDisplayImageUrl } from "@/lib/taskIllustration";
import {
  resolveTaskAssigneeUsers,
  resolveTaskAssignerUser,
  type TaskPersonAvatar,
} from "@/lib/userDisplayHelpers";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useAuth } from "@/hooks/useAuth";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { formatTaskDueRelative, getTaskDueUrgency } from "@/lib/taskDueUrgency";
import { resolveTaskSignalChip } from "@/lib/taskSignalChip";
import { TaskCardMediaZone } from "@/components/tasks/TaskCardMediaZone";
import { TaskStatusMark } from "@/components/tasks/TaskStatusMark";
import { useTaskCommentSignal } from "@/hooks/useTaskCommentSignals";
import {
  issuesSignalOverflowButtonClassName,
  issuesSignalReviewButtonClassName,
  issuesSignalSecondaryButtonClassName,
} from "@/components/dashboard/issues/IssuesSignalListParts";

/** Issues workbench “Open work” — same meta treatment as Recent signals (JetBrains Mono 10 / 600, caps). */
const WORKBENCH_TASK_META_CLASS =
  "text-2xs font-mono font-semibold uppercase tracking-wide text-muted-foreground leading-snug line-clamp-1";


// Property Icon Chip Component - shows property icon on property color background
// Matches META_CHIP size: 28×28, rounded-card
function PropertyIconChip({ property }: { property: any }) {
  if (!property) return null;
  
  const iconName = property.icon_name || "home";
  const IconComponent = getPropertyChipIcon(iconName);
  const iconColor = property.icon_color_hex || "#8EC9CE";
  const size = TASK_CARD_META_CHIP_SIZE;
  
  return (
    <div
      className="inline-flex items-center justify-center rounded-card border-0 flex-shrink-0"
      style={{
        backgroundColor: iconColor,
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
      }}
    >
      <IconComponent className="h-4 w-4 text-white" />
    </div>
  );
}

// Multiple Property Icon Chips - shows overlapping icons for multiple properties
function PropertyIconChips({ properties }: { properties: any[] }) {
  if (!properties || properties.length === 0) return null;
  
  // For single property, just show one chip
  if (properties.length === 1) {
    return <PropertyIconChip property={properties[0]} />;
  }
  
  const size = TASK_CARD_META_CHIP_SIZE;
  const overlapPx = size * 0.3;
  // For multiple properties, show overlapping chips (30% overlap)
  return (
    <div className="inline-flex items-center">
      {properties.map((property, index) => {
        const iconName = property?.icon_name || "home";
        const IconComponent = getPropertyChipIcon(iconName);
        const iconColor = property?.icon_color_hex || "#8EC9CE";
        const zIndex = properties.length - index;
        
        return (
          <div
            key={property?.id || index}
            className="inline-flex items-center justify-center rounded-card border-0 relative"
            style={{
              backgroundColor: iconColor,
              width: size,
              height: size,
              marginLeft: index > 0 ? `-${overlapPx}px` : "0",
              zIndex,
            }}
          >
            <IconComponent className="h-4 w-4 text-white" />
          </div>
        );
      })}
    </div>
  );
}

/** Initials-only person marks — same size/fill style as TaskStatusMark; no photos/arrows. */
function TaskCardPeopleMeta({
  assigner,
  assignee,
  className,
}: {
  assigner?: TaskPersonAvatar | null;
  assignee?: TaskPersonAvatar | null;
  className?: string;
}) {
  if (!assigner && !assignee) return null;

  // Initials marks only (no photos / arrows). Assigner then assignee when both present.
  const shown =
    assigner && assignee && assigner.name !== assignee.name
      ? [assigner, assignee]
      : [assignee ?? assigner!];

  const showChevron = shown.length === 2;

  return (
    <div
      className={cn("flex items-center gap-0.5 shrink-0", className)}
      title={
        [assigner?.name && `From ${assigner.name}`, assignee?.name && `For ${assignee.name}`]
          .filter(Boolean)
          .join(" → ") || undefined
      }
    >
      <UserAvatar
        name={shown[0].name}
        propertyColor={shown[0].accentColor}
        size={TASK_CARD_AVATAR_SIZE}
        shape="statusMark"
        initialsOnly
      />
      {showChevron ? (
        <ChevronRight
          className="h-2.5 w-2.5 shrink-0 text-muted-foreground"
          strokeWidth={2.5}
          aria-hidden
        />
      ) : null}
      {showChevron ? (
        <UserAvatar
          name={shown[1].name}
          propertyColor={shown[1].accentColor}
          size={TASK_CARD_AVATAR_SIZE}
          shape="statusMark"
          initialsOnly
        />
      ) : null}
    </div>
  );
}

/** Sentence-case display for task card metadata (matches property line tone). */
function sentenceCaseTaskDate(label: string): string {
  return label
    .split(" • ")
    .map((segment) =>
      segment
        .split(" ")
        .map((word) =>
          /^\d/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ")
    )
    .join(" • ");
}

function TaskCardComponent({
  task, 
  property, 
  onClick,
  isSelected = false,
  layout = 'horizontal',
  imagePosition = 'right',
  metaDensity = 'default',
  messagePreview = null,
}: { 
  task: any; 
  property?: any; 
  onClick?: () => void;
  isSelected?: boolean;
  layout?: 'horizontal' | 'vertical' | 'messages';
  /** Horizontal layout only — thumbnail side. */
  imagePosition?: 'left' | 'right';
  /** "compact" = fewer badges (Issues Open work). */
  metaDensity?: 'default' | 'compact';
  /** Tasks → Messages tab amended card content. */
  messagePreview?: TaskMessagePreview | null;
}) {
  const { orgId } = useActiveOrg();
  const { members } = useOrgMembers();
  const { user: currentUser } = useAuth();
  const { data: orgProperties = [] } = usePropertiesQuery();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteTaskMutation = useDeleteTaskMutation();
  const commentSignal = useTaskCommentSignal(task?.id);
  /** Property chip is only useful when the org has more than one property. */
  const showPropertyIconInMeta = orgProperties.length > 1;
  const [isCompleting, setIsCompleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // Shared confirm/settle phase — also driven by TaskDetailPanel's "Mark Complete"
  // so the list card animates no matter where completion was triggered from.
  const completionPhase = useTaskCompletionMotion(
    (state) => (task?.id ? state.phases[task.id] : undefined) ?? "idle"
  );
  
  // Memoize task mapping and image parsing to prevent re-renders
  // Only recalculate when task data actually changes, not when object reference changes
  const { t, imageUrl, themes, spaces, teams } = useMemo(() => {
    const mappedTask = mapTask(task);
    
    // Parse themes, spaces, and teams (handle both string and array formats)
    let themesArray: any[] = [];
    if (task?.themes) {
      if (typeof task.themes === 'string') {
        try {
          themesArray = JSON.parse(task.themes);
        } catch (e) {
          themesArray = [];
        }
      } else if (Array.isArray(task.themes)) {
        themesArray = task.themes;
      }
    }
    
    let spacesArray: any[] = [];
    if (task?.spaces) {
      if (typeof task.spaces === 'string') {
        try {
          spacesArray = JSON.parse(task.spaces);
        } catch (e) {
          spacesArray = [];
        }
      } else if (Array.isArray(task.spaces)) {
        spacesArray = task.spaces;
      }
    }
    
    let teamsArray: any[] = [];
    if (task?.teams) {
      if (typeof task.teams === 'string') {
        try {
          teamsArray = JSON.parse(task.teams);
        } catch (e) {
          teamsArray = [];
        }
      } else if (Array.isArray(task.teams)) {
        teamsArray = task.teams;
      }
    }
    
    const url = resolveTaskDisplayImageUrl(task, task?.title ?? mappedTask.title);

    return { 
      t: mappedTask, 
      imageUrl: url,
      themes: themesArray,
      spaces: spacesArray,
      teams: teamsArray,
    };
  }, [
    task?.id,
    task?.title,
    task?.status,
    task?.due_date,
    task?.priority,
    task?.images,
    task?.primary_image_url,
    task?.image_url,
    task?.themes,
    task?.spaces,
    task?.teams,
  ]);

  const assignedUsers = useMemo(
    () =>
      resolveTaskAssigneeUsers(task, members, property?.icon_color_hex || "#8EC9CE", currentUser),
    [
      task,
      members,
      property?.icon_color_hex,
      currentUser,
      task?.assigned_user_id,
      task?.assigned_user_name,
      task?.assignee_name,
    ]
  );

  const assignerUser = useMemo(
    () => resolveTaskAssignerUser(task, members, currentUser),
    [task, members, currentUser, task?.owner_user_id, task?.created_by, task?.assigned_user_id]
  );

  const assigneeUser = assignedUsers[0] ?? null;
  
  // Memoize handleDone to prevent recreation on every render
  const handleDone = useCallback(async () => {
    if (!task?.id || isCompleting) return;

    setIsCompleting(true);
    // Run the mutation in parallel with the confirm/settle motion. Capture the
    // outcome instead of awaiting immediately so an early rejection can't
    // surface as an unhandled promise while the motion plays.
    const mutation = markTaskCompleted(queryClient, task.id, {
      orgId,
      // Keep the card in the list; All shows a Done section for completed work.
      optimistic: false,
      skipCachePatch: true,
    }).then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error })
    );

    await playTaskCompletionMotion(task.id);

    const result = await mutation;
    if (result.ok) {
      toast({
        title: "Task completed",
        description: "Marked complete — it stays visible in All.",
      });
      // Refresh lists after the confirm motion; do not collapse the row away.
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks-briefing"] });
      if (orgId) {
        await queryClient.invalidateQueries({ queryKey: ["task", orgId, task.id] });
      }
    } else {
      toast({
        title: "Error",
        description: "Failed to complete task. Please try again.",
        variant: "destructive",
      });
    }
    clearTaskCompletionMotion(task.id);
    setIsCompleting(false);
  }, [task?.id, isCompleting, toast, queryClient, orgId]);
  
  // Don't show Done button if task is already archived or completed
  const showDoneButton = task?.status !== 'archived' && task?.status !== 'completed';
  const isCompleted = task?.status === "completed";
  /** On hold (paused) or completed — soften thumbnail / title / meta. */
  const dimThumbnail =
    isCompleted || task?.status === "waiting_review";
  const dimCopyClass = "opacity-40";

  const handleArchive = useCallback(
    async (e?: MouseEvent) => {
      e?.stopPropagation();
      if (!task?.id || !orgId || isArchiving) return;
      setIsArchiving(true);
      try {
        await archiveTask(task.id, orgId);
        await queryClient.invalidateQueries({ queryKey: ["tasks"] });
        await queryClient.invalidateQueries({ queryKey: ["tasks-briefing"] });
        toast({ title: "Task archived" });
      } catch (err) {
        toast({
          title: "Couldn't archive task",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsArchiving(false);
      }
    },
    [task?.id, orgId, isArchiving, queryClient, toast]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!task?.id || deleteTaskMutation.isPending) return;
    deleteTaskMutation.mutate(
      {
        taskId: task.id,
        orgId: orgId ?? undefined,
        propertyId: task.property_id ?? property?.id ?? null,
      },
      {
        onSuccess: () => {
          toast({ title: "Task deleted" });
          setShowDeleteDialog(false);
        },
        onError: (err) => {
          toast({
            title: "Couldn't delete task",
            description: err instanceof Error ? err.message : "Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  }, [task?.id, task?.property_id, property?.id, orgId, deleteTaskMutation, toast]);

  const completedHoverActions = (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={isArchiving}
        className={issuesSignalSecondaryButtonClassName}
        onClick={(e) => {
          void handleArchive(e);
        }}
      >
        {isArchiving ? "Archiving…" : "Archive"}
      </button>
      <button
        type="button"
        disabled={deleteTaskMutation.isPending}
        className={cn(
          issuesSignalSecondaryButtonClassName,
          "text-destructive hover:text-destructive"
        )}
        onClick={(e) => {
          e.stopPropagation();
          setShowDeleteDialog(true);
        }}
      >
        Delete
      </button>
    </div>
  );

  const deleteConfirmDialog = (
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete task?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete &quot;{task?.title ?? "this task"}&quot; and cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.stopPropagation();
              handleConfirmDelete();
            }}
          >
            {deleteTaskMutation.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const metaCompact = metaDensity === "compact";
  const dueUrgency = getTaskDueUrgency(task);
  const signalChip = resolveTaskSignalChip({
    priority: task?.priority,
    due_date: task?.due_date ?? t.due_at,
    status: task?.status,
  });
  const dueDateRaw = task?.due_date ?? t.due_at;
  const educationChipLabel = isStaffTrainingTask(task)
    ? "Learn Filla"
    : isOnboardingDemoTask(task)
      ? "Example"
      : null;
  const dueFormattedLabel = dueDateRaw ? formatTaskDate(dueDateRaw) : null;
  const dueRelativeLabel = formatTaskDueRelative(dueDateRaw);
  /** Property name is redundant when the org only has one property. */
  const propertyLabel = showPropertyIconInMeta
    ? property?.nickname || property?.address || property?.name || null
    : null;
  const spaceLabel = spaces[0]?.name ?? null;
  const locationLine = [propertyLabel, spaceLabel].filter(Boolean).join(" • ");

  const isConfirmingComplete = completionPhase !== "idle";
  const isCollapsingComplete = completionPhase === "collapse";

  /** Confirm phase: completed state shown in place before the card leaves.
   *  !absolute/!z-20 beat the paper-texture rule `div[class*="bg-card"] > *`
   *  (index.css) which forces direct card children to relative/z-1. */
  const completionOverlay = isConfirmingComplete ? (
    <div className="!absolute inset-0 !z-20 flex items-center justify-center rounded-card bg-card/60">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-vivid shadow-md animate-complete-pop">
        <Check className="h-5 w-5 text-white" strokeWidth={3} aria-hidden />
      </span>
    </div>
  ) : null;

  /** Settle phase: collapse the row/card so siblings move up smoothly rather than jumping. */
  const withCompletionSettle = (card: ReactNode) => (
    <div
      className={cn(
        "grid min-w-0 max-w-full transition-[grid-template-rows,opacity] ease-out",
        isCollapsingComplete ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]",
        isConfirmingComplete && "pointer-events-none"
      )}
      style={{ transitionDuration: `${COMPLETE_COLLAPSE_MS}ms` }}
      aria-hidden={isCollapsingComplete || undefined}
    >
      <div className={cn("min-h-0 min-w-0 max-w-full", isCollapsingComplete && "overflow-hidden")}>{card}</div>
    </div>
  );

  /** Category / tags under the title — all tags from task details, in a horizontal row. */
  const themeTagChips =
    themes.length > 0 ? (
      <div className="mt-[6px] flex min-w-0 flex-wrap items-center gap-1">
        {themes.map((theme: { id?: string; name?: string }, index: number) => {
          const label = theme?.name ? String(theme.name).toUpperCase() : null;
          if (!label) return null;
          return (
            <span
              key={theme.id ?? `${label}-${index}`}
              className={cn(
                "box-border inline-block h-[22px] w-fit max-w-full shrink-0 rounded-[6px] px-2",
                "bg-primary/20 font-mono text-2xs font-medium uppercase leading-[22px] tracking-wide text-primary-deep",
                "whitespace-nowrap overflow-hidden text-ellipsis align-top"
              )}
            >
              {label}
            </span>
          );
        })}
      </div>
    ) : null;

  const statusMark = (
    <div className="pointer-events-none absolute left-1.5 top-1.5 z-10">
      <TaskStatusMark
        status={
          isConfirmingComplete || task?.status === "completed"
            ? "completed"
            : task?.status
        }
        size="chip"
      />
    </div>
  );

  /**
   * Merged signal chip (EXPIRED → OVERDUE → URGENT → HIGH → DUE SOON) — top-right,
   * same 22px height as status mark. One chip only.
   * Kept as `dueUrgencyChip` so HMR/call sites stay stable after the merge.
   */
  const dueUrgencyChip =
    signalChip != null ? (
      <span
        className={cn(
          "absolute top-1.5 z-10 flex h-[22px] min-w-[72px] items-center justify-center rounded-[5px] px-2",
          // Leave room when the new-comment square sits on the card’s top-right
          commentSignal && layout !== "horizontal" ? "right-8" : "right-2",
          "font-mono text-2xs font-medium uppercase tracking-wide leading-none shadow-sm",
          signalChip.tone === "coral"
            ? "bg-destructive/90 text-white"
            : "bg-amber-500/90 text-white"
        )}
      >
        {signalChip.label}
      </span>
    ) : null;

  const newCommentBubble = commentSignal ? (
    <span
      className="pointer-events-none !absolute top-1.5 right-1.5 !z-20 flex h-5 w-5 items-center justify-center drop-shadow-sm"
      title="New comment"
      aria-label="New comment"
    >
      <MessageSquare
        className="h-[18px] w-[18px] text-amber-500 fill-amber-500"
        strokeWidth={0}
        aria-hidden
      />
    </span>
  ) : null;

  // Messages tab — compact message-first card (85px).
  if (layout === "messages") {
    const dimmed = !messagePreview?.isUnread;
    const dayLabel =
      formatMessageDayLabel(messagePreview?.createdAt, { includeToday: true }) ??
      "TODAY";

    return (
      <>
        {withCompletionSettle(
          <div
            className={cn(
              "task-card-messages",
              "rounded-card bg-card/60",
              "shadow-e1",
              "cursor-pointer hover:bg-card/80 active:scale-[0.99] transition-[transform,box-shadow,background-color,opacity] duration-150",
              "flex w-full max-w-full flex-row h-[85px] max-h-[85px] overflow-hidden relative group",
              isSelected && "bg-card shadow-e3",
              dimmed && "opacity-55"
            )}
            onClick={onClick}
          >
            {completionOverlay}
            <TaskCardMediaZone
              imageUrl={imageUrl}
              alt={t.title}
              variant="horizontal"
              fixedSize={85}
              dimmed={dimThumbnail || isConfirmingComplete}
              className="shrink-0"
            />
            <div className="relative flex min-w-0 flex-1 flex-col justify-center gap-0.5 overflow-hidden px-2.5 py-1.5">
              <h3 className="min-w-0 max-w-full truncate text-[11px] font-medium leading-tight text-foreground opacity-50">
                {t.title}
              </h3>
              {messagePreview ? (
                <div className="flex min-w-0 max-w-full items-start gap-1.5 overflow-hidden">
                  <UserAvatar
                    imageUrl={messagePreview.authorAvatarUrl}
                    name={messagePreview.authorName}
                    propertyColor={messagePreview.accentColor}
                    size={18}
                    shape="circle"
                    className="mt-0.5 shrink-0"
                  />
                  <p className="min-w-0 flex-1 line-clamp-2 text-[13px] font-medium leading-snug text-foreground">
                    {messagePreview.body}
                  </p>
                </div>
              ) : (
                <p className="min-w-0 max-w-full line-clamp-2 text-[13px] leading-snug text-muted-foreground">
                  No messages
                </p>
              )}
              <p className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/65">
                {dayLabel}
              </p>
            </div>
          </div>
        )}
        {deleteConfirmDialog}
      </>
    );
  }

  if (layout === 'horizontal') {
    const thumbnailFirst = imagePosition === 'left';

    const horizontalMedia = (
      <TaskCardMediaZone
        imageUrl={imageUrl}
        alt={t.title}
        variant="horizontal"
        dimmed={dimThumbnail || isConfirmingComplete}
      >
        {statusMark}
        {dueUrgencyChip}
        {showDoneButton && !metaCompact ? (
          <button
            type="button"
            aria-label="Mark task done"
            className="absolute bottom-2 right-2 z-10 cursor-pointer rounded-[6px] opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [@media(pointer:coarse)]:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              handleDone();
            }}
          >
            <Badge className="text-2xs px-2 h-[24px] bg-success text-success-foreground border-0">
              DONE
            </Badge>
          </button>
        ) : null}
      </TaskCardMediaZone>
    );

    return (
      <>
        {withCompletionSettle(
          <div
            className={cn(
              "task-card-horizontal",
              "rounded-card bg-card/60",
              "shadow-e1",
              "cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-[transform,box-shadow,background-color] duration-150",
              "overflow-hidden flex flex-row h-[108px] relative group",
              isSelected && "bg-card shadow-e3"
            )}
            onClick={onClick}
          >
            {completionOverlay}
            {newCommentBubble}
            {thumbnailFirst ? horizontalMedia : null}
            {/* Content — +3px down from prior py-4 centering */}
            <div className="relative flex min-w-0 flex-1 flex-col justify-center px-[14px] pb-[13px] pt-[12px]">
              {/* Title: reserved 2-line box, text bottom-aligned */}
              <div
                className={cn(
                  "flex h-[37.5px] min-w-0 items-end gap-2",
                  (dimThumbnail || isConfirmingComplete) && dimCopyClass,
                  isCompleted &&
                    "transition-opacity duration-150 group-hover:opacity-40 group-focus-within:opacity-40"
                )}
              >
                <h3 className="min-w-0 flex-1 text-[15px] font-medium leading-tight text-foreground line-clamp-2">
                  {t.title}
                </h3>
                {educationChipLabel ? (
                  <Badge
                    variant="neutral"
                    size="sm"
                    className="mb-0.5 h-[20px] shrink-0 border-0 bg-primary/15 px-1.5 text-2xs font-mono font-semibold uppercase tracking-wide text-primary-deep"
                  >
                    {educationChipLabel}
                  </Badge>
                ) : null}
              </div>

              {/* Tag chip under title (compact + default) */}
              {themeTagChips ? (
                <div className={cn((dimThumbnail || isConfirmingComplete) && dimCopyClass)}>
                  {themeTagChips}
                </div>
              ) : null}

              {/* Property Icon + Space + Date/Time + Teams + From / For */}
              <div
                className={cn(
                  "flex gap-2 flex-wrap items-center",
                  themeTagChips ? "mt-1" : "mt-[7px]",
                  (dimThumbnail || isConfirmingComplete) && dimCopyClass,
                  isCompleted &&
                    "transition-opacity duration-150 group-hover:opacity-0 group-hover:pointer-events-none group-focus-within:opacity-0 group-focus-within:pointer-events-none"
                )}
              >
                {showPropertyIconInMeta && property ? (
                  <PropertyIconChips properties={[property]} />
                ) : null}
                {metaCompact ? (
                  <>
                    {(spaces[0]?.name || t.due_at) && (
                      <span className={cn(WORKBENCH_TASK_META_CLASS, "min-w-0 flex-1")}>
                        {spaces[0]?.name ? `${spaces[0].name}` : ""}
                        {spaces[0]?.name && t.due_at ? " · " : ""}
                        {t.due_at ? formatTaskDate(t.due_at) : ""}
                      </span>
                    )}
                    <TaskCardPeopleMeta
                      assigner={assignerUser}
                      assignee={assigneeUser}
                      className="ml-auto"
                    />
                  </>
                ) : (
                  <>
                    {spaces.length > 0 && (
                      <Badge
                        variant="neutral"
                        size="sm"
                        className="text-2xs px-[5px] font-mono uppercase h-[24px]"
                      >
                        {spaces[0].name}
                      </Badge>
                    )}
                    {t.due_at && (
                      <Badge
                        variant="neutral"
                        size="sm"
                        className="text-2xs px-[5px] flex items-center gap-1 font-mono h-[24px]"
                      >
                        <Clock className="h-3 w-3" />
                        {formatTaskDate(t.due_at)}
                      </Badge>
                    )}
                    {teams.length > 0 &&
                      teams.map((team: any) => (
                        <Badge
                          key={team.id}
                          variant="neutral"
                          size="sm"
                          className="text-2xs px-[5px] font-mono uppercase h-[24px]"
                        >
                          {team.name}
                        </Badge>
                      ))}
                    <TaskCardPeopleMeta
                      assigner={assignerUser}
                      assignee={assigneeUser}
                      className="ml-auto"
                    />
                  </>
                )}
              </div>

              {isCompleted ? (
                <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto [@media(pointer:coarse)]:opacity-100 [@media(pointer:coarse)]:pointer-events-auto">
                  {completedHoverActions}
                </div>
              ) : null}
            </div>

            {!thumbnailFirst ? horizontalMedia : null}
          </div>
        )}
        {deleteConfirmDialog}
      </>
    );
  }

  // Vertical layout (image on top)
  return (
    <>
      {withCompletionSettle(
    <div 
      className={cn(
        "task-card-vertical h-[290px] w-full min-w-0",
        "rounded-card bg-card/60",
        "shadow-e1",
        "cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-[transform,box-shadow,background-color] duration-150",
        "overflow-hidden flex flex-col relative group",
        isSelected && "bg-card shadow-e3"
      )}
      onClick={onClick}
    >
      {completionOverlay}
      {newCommentBubble}
      <TaskCardMediaZone
        imageUrl={imageUrl}
        alt={t.title}
        variant="vertical"
        dimmed={dimThumbnail || isConfirmingComplete}
      >
        {statusMark}
        {dueUrgencyChip}
      </TaskCardMediaZone>

      {/* Content */}
      <div className="flex flex-1 flex-col px-[12px] pt-[12px] pb-[12px] min-h-0">
        <div
          className={cn(
            (dimThumbnail || isConfirmingComplete) && dimCopyClass
          )}
        >
          <h3 className="pb-[5px] text-[15px] font-medium text-foreground line-clamp-2 leading-tight">
            {t.title}
          </h3>

          {themeTagChips}

          {locationLine ? (
            <p className="mt-2 flex min-w-0 items-center gap-1.5 text-caption leading-none text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate leading-none">{locationLine}</span>
            </p>
          ) : null}

          {dueFormattedLabel ? (
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-caption leading-none text-muted-foreground">
              <Calendar className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate leading-none">{sentenceCaseTaskDate(dueFormattedLabel)}</span>
            </p>
          ) : null}
        </div>

        <div className="relative mt-auto min-h-[32px] pt-3">
          {/* Default footer — relative due + assignee */}
          <div
            className={cn(
              "flex items-center justify-between gap-2 transition-opacity duration-150 group-hover:opacity-0 group-hover:pointer-events-none group-focus-within:opacity-0 group-focus-within:pointer-events-none",
              (dimThumbnail || isConfirmingComplete) && dimCopyClass
            )}
          >
            {dueRelativeLabel ? (
              <span
                className={cn(
                  "min-w-0 truncate text-caption",
                  dueUrgency === "overdue" ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {dueRelativeLabel}
              </span>
            ) : (
              <span className="min-w-0 flex-1" />
            )}
            {assignerUser || assigneeUser ? (
              <TaskCardPeopleMeta assigner={assignerUser} assignee={assigneeUser} />
            ) : null}
          </div>

          {/* Hover — CTA buttons */}
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
            {isCompleted ? (
              <>
                {completedHoverActions}
                <div className="ml-auto shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="More actions"
                        className={issuesSignalOverflowButtonClassName}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      side="top"
                      sideOffset={4}
                      className="min-w-[8rem] rounded-card border-border/60 bg-card p-1 shadow-md"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenuItem
                        className="cursor-pointer px-3 py-1.5 text-xs text-foreground focus:bg-muted/40"
                        onSelect={(e) => {
                          e.preventDefault();
                          onClick?.();
                        }}
                      >
                        Details
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            ) : (
              <>
            <button
              type="button"
              className={issuesSignalReviewButtonClassName}
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
            >
              Take Action
            </button>
            <button
              type="button"
              className={issuesSignalSecondaryButtonClassName}
              onClick={(e) => {
                e.stopPropagation();
                toast({
                  title: "Snooze",
                  description: "Snooze will be available soon.",
                });
              }}
            >
              Snooze
            </button>
            <div className="ml-auto shrink-0">
              <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More actions"
                className={issuesSignalOverflowButtonClassName}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={4}
              className="min-w-[8rem] rounded-card border-border/60 bg-card p-1 shadow-md"
              onClick={(e) => e.stopPropagation()}
            >
              {showDoneButton ? (
                <DropdownMenuItem
                  disabled={isCompleting}
                  className="cursor-pointer px-3 py-1.5 text-xs text-foreground focus:bg-muted/40"
                  onSelect={(e) => {
                    e.preventDefault();
                    void handleDone();
                  }}
                >
                  {isCompleting ? "Completing…" : "Mark done"}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                className="cursor-pointer px-3 py-1.5 text-xs text-foreground focus:bg-muted/40"
                onSelect={(e) => {
                  e.preventDefault();
                  onClick?.();
                }}
              >
                Details
              </DropdownMenuItem>
            </DropdownMenuContent>
              </DropdownMenu>
            </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
      )}
      {deleteConfirmDialog}
    </>
  );
}

// Memoize TaskCard with custom comparison to prevent unnecessary re-renders
// Returns true if props are equal (skip re-render), false if different (re-render)
const TaskCard = memo(TaskCardComponent, (prevProps, nextProps) => {
  // Quick reference equality check first
  if (prevProps === nextProps) return true;
  
  // If task ID changed, definitely re-render
  if (prevProps.task?.id !== nextProps.task?.id) return false;
  
  // If selection state changed, re-render
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  
  // If layout changed, re-render
  if (prevProps.layout !== nextProps.layout) return false;

  if (prevProps.imagePosition !== nextProps.imagePosition) return false;

  if (prevProps.metaDensity !== nextProps.metaDensity) return false;

  if (prevProps.messagePreview?.messageId !== nextProps.messagePreview?.messageId) return false;
  if (prevProps.messagePreview?.isUnread !== nextProps.messagePreview?.isUnread) return false;
  if (prevProps.messagePreview?.body !== nextProps.messagePreview?.body) return false;
  if (prevProps.messagePreview?.isOwnLatest !== nextProps.messagePreview?.isOwnLatest) return false;
  
  // If property changed, re-render
  if (prevProps.property?.id !== nextProps.property?.id) return false;
  
  // Compare all task data that affects rendering
  const prevTask = prevProps.task;
  const nextTask = nextProps.task;
  
  const fieldsChanged = prevTask?.status !== nextTask?.status ||
    prevTask?.title !== nextTask?.title ||
    prevTask?.due_date !== nextTask?.due_date ||
    prevTask?.priority !== nextTask?.priority ||
    prevTask?.assigned_user_id !== nextTask?.assigned_user_id ||
    prevTask?.owner_user_id !== nextTask?.owner_user_id ||
    prevTask?.created_by !== nextTask?.created_by ||
    JSON.stringify(prevTask?.teams) !== JSON.stringify(nextTask?.teams) ||
    JSON.stringify(prevTask?.themes) !== JSON.stringify(nextTask?.themes);

  if (fieldsChanged) {
    return false; // Task fields changed, re-render
  }
  
  const prevImageUrl = resolveTaskDisplayImageUrl(prevTask, prevTask?.title);
  const nextImageUrl = resolveTaskDisplayImageUrl(nextTask, nextTask?.title);
  if (prevImageUrl !== nextImageUrl) return false;
  
  // onClick comparison - if both are functions, we assume they're equivalent if task.id is the same
  // This prevents re-renders when onClick function reference changes but functionality is the same
  // (The onClick handler is recreated but does the same thing)
  
  // All props are equal, skip re-render
  return true;
});

export default TaskCard;