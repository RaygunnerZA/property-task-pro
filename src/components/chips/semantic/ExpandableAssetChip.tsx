/**
 * ExpandableAssetChip - SemanticChip with dropdown for asset management.
 */

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CopyPlus, Eye, Pencil, X } from "lucide-react";
import { SemanticChip } from "./SemanticChip";
import { cn } from "@/lib/utils";

export interface ExpandableAssetChipProps {
  label: string;
  onRemove: () => void;
  onView?: () => void;
  onRename?: () => void;
  onDuplicate?: () => void;
  color?: string;
  className?: string;
}

const itemClassName = cn(
  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5",
  "font-mono text-2xs uppercase tracking-wide",
  "min-h-0 focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
);

export function ExpandableAssetChip({
  label,
  onRemove,
  onView,
  onRename,
  onDuplicate,
  color,
  className,
}: ExpandableAssetChipProps) {
  const dropdownContent = (
    <>
      {onView ? (
        <DropdownMenuItem onSelect={() => onView()} className={itemClassName}>
          <Eye className="h-3 w-3 shrink-0" aria-hidden />
          View
        </DropdownMenuItem>
      ) : null}

      <DropdownMenuItem
        onSelect={() => onRename?.()}
        disabled={!onRename}
        className={itemClassName}
      >
        <Pencil className="h-3 w-3 shrink-0" aria-hidden />
        Rename
      </DropdownMenuItem>

      <DropdownMenuItem
        onSelect={() => onDuplicate?.()}
        disabled={!onDuplicate}
        className={itemClassName}
      >
        <CopyPlus className="h-3 w-3 shrink-0" aria-hidden />
        Duplicate
      </DropdownMenuItem>

      <DropdownMenuSeparator className="my-0.5" />

      <DropdownMenuItem onSelect={() => onRemove()} className={itemClassName}>
        <X className="h-3 w-3 shrink-0" aria-hidden />
        Remove
      </DropdownMenuItem>
    </>
  );

  return (
    <SemanticChip
      epistemic="fact"
      label={label}
      dropdown
      dropdownContent={dropdownContent}
      color={color}
      className={className}
    />
  );
}
