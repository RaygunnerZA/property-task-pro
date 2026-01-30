import { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export interface ExpandableFactChipProps {
  label: string;
  subSpaces: string[];
  onRemove: () => void;
  onAddSubSpace: (name: string) => void;
  className?: string;
}

/**
 * Fact chip with down chevron (visible on hover or when open) that expands to a dropdown:
 * - Sub-spaces list (• name) when present
 * - "+ Sub-space" to add a child
 * - "X | More" (Remove and More)
 */
export function ExpandableFactChip({
  label,
  subSpaces,
  onRemove,
  onAddSubSpace,
  className,
}: ExpandableFactChipProps) {
  const [open, setOpen] = useState(false);
  const [isAddingSubSpace, setIsAddingSubSpace] = useState(false);
  const [newSubSpaceName, setNewSubSpaceName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && isAddingSubSpace) {
      inputRef.current?.focus();
    }
  }, [open, isAddingSubSpace]);

  const handleAddSubSpaceSubmit = () => {
    const trimmed = newSubSpaceName.trim();
    if (!trimmed) return;
    onAddSubSpace(trimmed);
    setNewSubSpaceName("");
    setIsAddingSubSpace(false);
  };

  const handleRemove = () => {
    setOpen(false);
    onRemove();
  };

  const chipStyles = cn(
    "relative inline-flex items-center h-[28px] min-h-[28px] pl-2.5 pr-2.5 py-1 rounded-[8px]",
    "group-hover:pr-6 data-[state=open]:pr-6",
    "font-mono uppercase tracking-wide text-[11px]",
    "bg-white text-foreground border-0 shadow-[1px_2px_2px_0px_rgba(0,0,0,0.15),-2px_-2px_2px_0px_rgba(255,255,255,0.7)]",
    "cursor-pointer select-none transition-all duration-150 overflow-visible",
    className
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(chipStyles, "group")}
          aria-expanded={open}
          aria-haspopup="true"
        >
          <span className="truncate max-w-[120px]">{label}</span>
          <ChevronDown
            className={cn(
              "absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 flex-shrink-0 transition-all duration-150 pointer-events-none",
              open ? "rotate-180 opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="min-w-[160px] p-0 text-[10px]"
        onCloseAutoFocus={() => {
          setIsAddingSubSpace(false);
          setNewSubSpaceName("");
        }}
      >
        {isAddingSubSpace && (
          <>
            <div className="px-1.5 py-1 border-b border-muted/50">
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
                className="mt-1 w-full py-0.5 text-[10px] font-mono text-primary disabled:opacity-50"
              >
                Add
              </button>
            </div>
            <DropdownMenuSeparator className="my-0.5" />
          </>
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
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setIsAddingSubSpace(true);
            }}
            className="font-mono text-[10px] uppercase tracking-wide py-1 px-1.5 min-h-0"
          >
            <Plus className="h-3 w-3 mr-1.5" />
            Sub-space
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className="my-0.5" />

        <div className="flex items-center gap-0.5 px-1 py-0">
          <DropdownMenuItem
            onSelect={() => handleRemove()}
            className="flex-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide cursor-pointer rounded py-0.5 px-1 min-h-0"
          >
            <X className="h-3 w-3" />
            Remove
          </DropdownMenuItem>
          <span className="text-muted-foreground/60 font-mono text-[10px]">|</span>
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex-1 flex items-center justify-center font-mono text-[10px] uppercase tracking-wide cursor-pointer rounded py-0.5 px-1 min-h-0"
          >
            More
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
