/**
 * ExpandableSpaceChip - SemanticChip with dropdown for space management.
 * Dropdown: + Sub-space | Rename, Duplicate | Remove.
 */

import { useState, useRef, useEffect } from "react";
import { CopyPlus, Pencil, Plus, X } from "lucide-react";
import { SemanticChip } from "./SemanticChip";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export interface ExpandableSpaceChipProps {
  label: string;
  subSpaces: string[];
  onRemove: () => void;
  onAddSubSpace: (name: string) => void;
  onRename?: () => void;
  onDuplicate?: () => void;
  color?: string;
  className?: string;
}

export function ExpandableSpaceChip({
  label,
  subSpaces,
  onRemove,
  onAddSubSpace,
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
      {isAddingSubSpace && (
        <div className="px-1.5 py-1">
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
            className="w-full px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide rounded border border-input bg-background outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            onClick={handleAddSubSpaceSubmit}
            disabled={!newSubSpaceName.trim()}
            className="mt-1 w-full py-0.5 text-[10px] font-mono uppercase tracking-wide text-primary opacity-100 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}

      {subSpaces.length > 0 && (
        <>
          {subSpaces.map((name) => (
            <DropdownMenuItem
              key={name}
              className="font-mono text-[10px] uppercase tracking-wide cursor-default py-1 px-1.5 min-h-0"
              onSelect={(e) => e.preventDefault()}
            >
              <span className="text-muted-foreground mr-1">•</span>
              {name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator className="my-0.5" />
        </>
      )}

      {!isAddingSubSpace && (
        <div className="flex items-center gap-0.5 px-0.5 py-0">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setIsAddingSubSpace(true);
            }}
            className="flex-1 flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide cursor-pointer rounded py-1 px-1 min-h-0"
          >
            <Plus className="h-3 w-3" />
            Sub-space
          </DropdownMenuItem>
          <span className="text-muted-foreground/60 font-mono text-[10px]">|</span>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              onRename?.();
            }}
            disabled={!onRename}
            className="flex-1 flex items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-wide cursor-pointer rounded py-0.5 px-0.5 min-h-0"
          >
            <Pencil className="h-3 w-3" />
            Rename
          </DropdownMenuItem>
        </div>
      )}

      <DropdownMenuSeparator className="my-0.5" />

      <div className="flex h-9 items-center gap-0.5 px-0.5 py-0">
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onDuplicate?.();
          }}
          disabled={!onDuplicate}
          className="flex-1 flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide cursor-pointer rounded py-1 px-0.5 min-h-0"
        >
          <CopyPlus className="h-3 w-3" />
          Duplicate
        </DropdownMenuItem>
        <span className="text-muted-foreground/60 font-mono text-[10px]">|</span>
        <DropdownMenuItem
          onSelect={() => onRemove()}
          className="flex-1 flex items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-wide cursor-pointer rounded py-0.5 px-0 min-h-0"
        >
          <X className="h-3 w-3" />
          Remove
        </DropdownMenuItem>
      </div>
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
