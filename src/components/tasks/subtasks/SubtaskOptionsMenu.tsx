import {
  MoreHorizontal,
  Copy,
  Trash2,
  Star,
  User,
  StickyNote,
  GitBranch,
  Check,
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
  onToggleRequired: () => void;
  onAddNote: () => void;
  onToggleFollowupIfFailed: () => void;
  onOpenAssignPicker: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function SubtaskOptionsMenu({
  isCreator = true,
  isRequired = false,
  hasNote = false,
  hasFollowupIfFailed = false,
  assignedUserName,
  onToggleRequired,
  onAddNote,
  onToggleFollowupIfFailed,
  onOpenAssignPicker,
  onDuplicate,
  onDelete,
}: SubtaskOptionsMenuProps) {
  if (isCreator) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 shadow-none opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card border-0 shadow-e2 rounded-xl">
          <DropdownMenuItem onClick={onToggleRequired} className="gap-2 text-sm">
            <Star
              className={`h-4 w-4 ${isRequired ? "text-[#EB6834] fill-[#EB6834]" : "text-muted-foreground"}`}
            />
            {isRequired ? "Remove Required" : "Mark Required"}
            {isRequired && <Check className="h-3.5 w-3.5 text-[#EB6834] ml-auto" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenAssignPicker} className="gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            {assignedUserName ? `Assigned: ${assignedUserName}` : "Assign to User"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAddNote} className="gap-2 text-sm">
            <StickyNote className="h-4 w-4 text-muted-foreground" />
            {hasNote ? "Remove Note" : "Add Note"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleFollowupIfFailed} className="gap-2 text-sm">
            <GitBranch
              className={`h-4 w-4 ${hasFollowupIfFailed ? "text-amber-500" : "text-muted-foreground"}`}
            />
            {hasFollowupIfFailed ? "Remove Follow-up" : "Add Follow-up if Failed"}
            {hasFollowupIfFailed && <Check className="h-3.5 w-3.5 text-amber-500 ml-auto" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDuplicate} className="gap-2 text-sm">
            <Copy className="h-4 w-4" />
            Duplicate Step
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="gap-2 text-sm text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete Step
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity"
        >
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card border-0 shadow-e2 rounded-xl">
        <DropdownMenuItem className="gap-2 text-sm">
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 text-sm">
          Request Edit
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
