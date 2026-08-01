/**
 * ExpandableSpaceChip - SemanticChip with dropdown for space management.
 * Vertical list: View, Sub-space, Rename, Duplicate, Remove.
 */

import { useState, useRef, useEffect } from "react";
import { CopyPlus, Eye, Pencil, Plus, X } from "lucide-react";
import { SemanticChip } from "./SemanticChip";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ExpandableSpaceChipProps {
  label: string;
  subSpaces: string[];
  onRemove: () => void;
  onAddSubSpace: (name: string) => void;
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

export function ExpandableSpaceChip({
  label,
  subSpaces,
  onRemove,
  onAddSubSpace,
  onView,
  onRename,
  onDuplicate,
  color,
  className,
}: ExpandableSpaceChipProps) {
  const [isAddingSubSpace, setIsAddingSubSpace] = useState(false);
  const [newSubSpaceName, setNewSubSpaceName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAddingSubSpace) {
      inputRef.current?.focus();
    }
  }, [isAddingSubSpace]);

  const handleAddSubSpaceSubmit = () => {
    const trimmed = newSubSpaceName.trim();
    if (!trimmed) return;
    onAddSubSpace(trimmed);
    setNewSubSpaceName("");
    setIsAddingSubSpace(false);
  };

  const dropdownContent = (
    <>
      {isAddingSubSpace ? (
        <div className="px-2 py-1.5">
          <input
            ref={inputRef}
            type="text"
            value={newSubSpaceName}
            onChange={(e) => setNewSubSpaceName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddSubSpaceSubmit();
              }
              if (e.key === "Escape") {
                setIsAddingSubSpace(false);
                setNewSubSpaceName("");
              }
            }}
            placeholder="Sub-space name..."
            className="w-full rounded border border-input bg-background px-1.5 py-1 text-2xs font-mono uppercase tracking-wide outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            onClick={handleAddSubSpaceSubmit}
            disabled={!newSubSpaceName.trim()}
            className="mt-1.5 w-full py-1 text-2xs font-mono uppercase tracking-wide text-primary disabled:opacity-50"
          >
            Add
          </button>
        </div>
      ) : (
        <>
          {onView ? (
            <DropdownMenuItem
              onSelect={() => {
                onView();
              }}
              className={itemClassName}
            >
              <Eye className="h-3 w-3 shrink-0" aria-hidden />
              View
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setIsAddingSubSpace(true);
            }}
            className={itemClassName}
          >
            <Plus className="h-3 w-3 shrink-0" aria-hidden />
            Sub-space
          </DropdownMenuItem>

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
      )}

      {subSpaces.length > 0 && !isAddingSubSpace && (
        <>
          <DropdownMenuSeparator className="my-0.5" />
          {subSpaces.map((name) => (
            <DropdownMenuItem
              key={name}
              className={cn(itemClassName, "cursor-default text-muted-foreground")}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="mr-0.5" aria-hidden>
                •
              </span>
              {name}
            </DropdownMenuItem>
          ))}
        </>
      )}
    </>
  );

  return (
    <SemanticChip
      epistemic="fact"
      label={label}
      dropdown
      dropdownContent={dropdownContent}
      color={color}
      onDropdownOpenChange={(open) => {
        if (!open) {
          setIsAddingSubSpace(false);
          setNewSubSpaceName("");
        }
      }}
      className={className}
    />
  );
}
