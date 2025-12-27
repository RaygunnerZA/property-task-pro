import { MoreHorizontal, Copy, Trash2, ToggleLeft, PenLine } from "lucide-react";
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
  onConvertToYesNo: () => void;
  onAddSignature: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function SubtaskOptionsMenu({
  isCreator = true,
  onConvertToYesNo,
  onAddSignature,
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
            className="h-7 w-7 shrink-0 shadow-none"
          >
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card border shadow-e2">
          <DropdownMenuItem onClick={onConvertToYesNo} className="gap-2 text-sm">
            <ToggleLeft className="h-4 w-4" />
            Convert to Yes/No Question
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAddSignature} className="gap-2 text-sm">
            <PenLine className="h-4 w-4" />
            Add Signature Requirement
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate} className="gap-2 text-sm">
            <Copy className="h-4 w-4" />
            Duplicate Subtask
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="gap-2 text-sm text-destructive">
            <Trash2 className="h-4 w-4" />
            Delete Subtask
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Non-creator menu
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
        >
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card border shadow-e2">
        <DropdownMenuItem className="gap-2 text-sm">
          Mark Yes/No Answer
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 text-sm">
          Attach Signature
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 text-sm">
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 text-sm text-muted-foreground">
          Request Edit
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
