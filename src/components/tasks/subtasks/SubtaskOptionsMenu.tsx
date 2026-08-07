import {
  MoreHorizontal,
  Copy,
  Trash2,
  Star,
  User,
  StickyNote,
  GitBranch,
  Check,
  RotateCcw,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SubtaskOptionsMenuProps {
  isCreator?: boolean;
  isRequired?: boolean;
  hasNote?: boolean;
  hasFollowupIfFailed?: boolean;
  assignedUserName?: string;
  /** Execute mode: step already has a recorded response. */
  canClearResponse?: boolean;
  /** Execute mode: allow delete / edit-structure when the viewer can manage the task. */
  canEditStructure?: boolean;
  onToggleRequired: () => void;
  onAddNote: () => void;
  onToggleFollowupIfFailed: () => void;
  onOpenAssignPicker: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClearResponse?: () => void;
  onRequestAuthoring?: () => void;
}

export function SubtaskOptionsMenu({
  isCreator = true,
  isRequired = false,
  hasNote = false,
  hasFollowupIfFailed = false,
  assignedUserName,
  canClearResponse = false,
  canEditStructure = false,
  onToggleRequired,
  onAddNote,
  onToggleFollowupIfFailed,
  onOpenAssignPicker,
  onDuplicate,
  onDelete,
  onClearResponse,
  onRequestAuthoring,
}: SubtaskOptionsMenuProps) {
  const hasExecuteActions =
    Boolean(canClearResponse && onClearResponse) ||
    Boolean(canEditStructure) ||
    Boolean(onRequestAuthoring);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 shadow-none opacity-100"
          aria-label="Checklist step options"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        // Above task Dialog (z-110) so the menu is visible and clickable.
        className="z-[130] bg-card border-0 shadow-e2 rounded-xl"
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {isCreator ? (
          <>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onToggleRequired();
              }}
              className={`gap-2 text-sm ${!isRequired ? "text-primary-deep focus:text-primary-deep" : ""}`}
            >
              <Star
                className={`h-4 w-4 ${isRequired ? "text-accent fill-accent" : "text-primary-deep"}`}
              />
              {isRequired ? "Remove Required" : "Mark Required"}
              {isRequired && <Check className="h-3.5 w-3.5 text-accent ml-auto" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onOpenAssignPicker();
              }}
              className="gap-2 text-sm"
            >
              <User className="h-4 w-4 text-current" />
              {assignedUserName ? `Assigned: ${assignedUserName}` : "Assign to User"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onAddNote();
              }}
              className="gap-2 text-sm"
            >
              <StickyNote className="h-4 w-4 text-current" />
              {hasNote ? "Remove Note" : "Add Note"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onToggleFollowupIfFailed();
              }}
              className="gap-2 text-sm text-destructive focus:text-destructive"
            >
              <GitBranch className="h-4 w-4 text-destructive" />
              {hasFollowupIfFailed ? "Remove Follow-up" : "Add Follow-up if Failed"}
              {hasFollowupIfFailed && <Check className="h-3.5 w-3.5 text-destructive ml-auto" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onDuplicate();
              }}
              className="gap-2 text-sm"
            >
              <Copy className="h-4 w-4" />
              Duplicate Step
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onDelete();
              }}
              className="gap-2 text-sm text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete Step
            </DropdownMenuItem>
          </>
        ) : hasExecuteActions ? (
          <>
            {canClearResponse && onClearResponse ? (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  onClearResponse();
                }}
                className="gap-2 text-sm"
              >
                <RotateCcw className="h-4 w-4" />
                Clear response
              </DropdownMenuItem>
            ) : null}
            {onRequestAuthoring ? (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  onRequestAuthoring();
                }}
                className="gap-2 text-sm"
              >
                <Pencil className="h-4 w-4" />
                Edit checklist
              </DropdownMenuItem>
            ) : null}
            {canEditStructure ? (
              <>
                {(canClearResponse || onRequestAuthoring) && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    onDuplicate();
                  }}
                  className="gap-2 text-sm"
                >
                  <Copy className="h-4 w-4" />
                  Duplicate Step
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    onDelete();
                  }}
                  className="gap-2 text-sm text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Step
                </DropdownMenuItem>
              </>
            ) : null}
          </>
        ) : (
          <DropdownMenuItem disabled className="gap-2 text-sm text-muted-foreground">
            No actions yet
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
