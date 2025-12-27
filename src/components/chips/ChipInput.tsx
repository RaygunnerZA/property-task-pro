import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { StandardChip } from "./StandardChip";
import { Input } from "@/components/ui/input";
import { GripVertical, X, Loader2, Sparkles, MapPin, User, Users, Folder, AlertTriangle, Package, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAIExtract } from "@/hooks/useAIExtract";

export interface Chip {
  id: string;
  label: string;
  ghost?: boolean;
  color?: string;
  icon?: React.ReactNode;
  children?: Chip[]; // Nested chips
  metadata?: Record<string, unknown>; // For storing theme type, etc.
}

export interface ChipInputProps {
  chips: Chip[];
  onChipsChange: (chips: Chip[]) => void;
  placeholder?: string;
  className?: string;
  availableChips?: Chip[]; // Chips available for selection (for filtering)
  onCreateGhost?: (label: string) => void; // Callback when ghost chip is created
  onFilter?: (query: string) => Chip[]; // Custom filter function
}

interface SortableChipItemProps {
  chip: Chip;
  isDragging: boolean;
  onRemove: () => void;
  isNested?: boolean;
}

function SortableChipItem({ chip, isDragging, onRemove, isNested = false }: SortableChipItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: chip.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "inline-flex items-center gap-1 group",
        (isDragging || isSortableDragging) && "opacity-50 z-50"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="h-3 w-3 text-muted-foreground/40" />
      </div>
      <StandardChip
        label={chip.label}
        ghost={chip.ghost}
        color={chip.color}
        icon={chip.icon}
        selected={!chip.ghost}
        onRemove={onRemove}
        className="flex-shrink-0"
      />
      {chip.children && chip.children.length > 0 && (
            <div className="ml-2 flex flex-wrap gap-1 pl-4 border-l-2 border-border/30">
              {chip.children.map((child) => (
                <StandardChip
                  key={child.id}
                  label={child.label}
                  ghost={child.ghost}
                  color={child.color}
                  icon={child.icon}
                  selected={!child.ghost}
                  onRemove={() => {
                    // Remove nested chip
                    const updatedChip = {
                      ...chip,
                      children: chip.children?.filter((c) => c.id !== child.id),
                    };
                    const newChips = chips.map((c) =>
                      c.id === chip.id ? updatedChip : c
                    );
                    onChipsChange(newChips);
                  }}
                  className="flex-shrink-0"
                />
              ))}
            </div>
      )}
    </div>
  );
}

export function ChipInput({
  chips,
  onChipsChange,
  placeholder = "Type to filter or create...",
  className,
  availableChips = [],
  onCreateGhost,
  onFilter,
}: ChipInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedOverId, setDraggedOverId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // AI extraction
  const { result: aiResult, loading: aiLoading } = useAIExtract(inputValue);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Flatten chips for drag and drop (include nested chips)
  const getAllChipIds = useCallback((chipList: Chip[]): string[] => {
    const ids: string[] = [];
    chipList.forEach((chip) => {
      ids.push(chip.id);
      if (chip.children) {
        ids.push(...getAllChipIds(chip.children));
      }
    });
    return ids;
  }, []);

  // Find chip by ID (including nested)
  const findChipById = useCallback(
    (id: string, chipList: Chip[] = chips): Chip | null => {
      for (const chip of chipList) {
        if (chip.id === id) return chip;
        if (chip.children) {
          const found = findChipById(id, chip.children);
          if (found) return found;
        }
      }
      return null;
    },
    [chips]
  );

  // Remove chip by ID (including nested)
  const removeChipById = useCallback(
    (id: string, chipList: Chip[]): Chip[] => {
      return chipList
        .filter((chip) => chip.id !== id)
        .map((chip) => {
          if (chip.children) {
            return {
              ...chip,
              children: removeChipById(id, chip.children),
            };
          }
          return chip;
        });
    },
    []
  );

  // Add chip as child of another chip
  const addChipAsChild = useCallback(
    (parentId: string, childChip: Chip, chipList: Chip[]): Chip[] => {
      return chipList.map((chip) => {
        if (chip.id === parentId) {
          return {
            ...chip,
            children: [...(chip.children || []), childChip],
          };
        }
        if (chip.children) {
          return {
            ...chip,
            children: addChipAsChild(parentId, childChip, chip.children),
          };
        }
        return chip;
      });
    },
    []
  );

  // Check if chip is nested
  const isChipNested = useCallback(
    (chipId: string, chipList: Chip[] = chips): boolean => {
      for (const chip of chipList) {
        if (chip.children) {
          if (chip.children.some((c) => c.id === chipId)) return true;
          if (isChipNested(chipId, chip.children)) return true;
        }
      }
      return false;
    },
    [chips]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setDraggedOverId(over ? (over.id as string) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setDraggedOverId(null);

    if (!over || active.id === over.id) return;

    const draggedChip = findChipById(active.id as string);
    if (!draggedChip) return;

    // Don't allow dragging nested chips (for now)
    if (isChipNested(draggedChip.id)) return;

    const overChip = findChipById(over.id as string);
    if (!overChip) return;

    // Don't allow nesting into nested chips
    if (isChipNested(overChip.id)) {
      // Just reorder instead
      const oldIndex = chips.findIndex((c) => c.id === active.id);
      const newIndex = chips.findIndex((c) => c.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        onChipsChange(arrayMove(chips, oldIndex, newIndex));
      }
      return;
    }

    // If dragging onto another top-level chip, nest it
    if (draggedChip.id !== overChip.id) {
      // Remove from current position
      let newChips = removeChipById(draggedChip.id, chips);

      // Add as child of target chip
      newChips = addChipAsChild(overChip.id, draggedChip, newChips);

      onChipsChange(newChips);
      return;
    }

    // Otherwise, reorder
    const oldIndex = chips.findIndex((c) => c.id === active.id);
    const newIndex = chips.findIndex((c) => c.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      onChipsChange(arrayMove(chips, oldIndex, newIndex));
    }
  };

  // Convert AI result to Chip objects (ghost state)
  const aiChips = useMemo(() => {
    if (!aiResult) return [];

    const smartChips: Chip[] = [];

    // Spaces
    aiResult.spaces.forEach((space) => {
      smartChips.push({
        id: space.exists && space.id ? space.id : `ghost-space-${space.name}-${Date.now()}`,
        label: space.name,
        ghost: !space.exists,
        icon: <MapPin className="h-3 w-3" />,
      });
    });

    // People
    aiResult.people.forEach((person) => {
      smartChips.push({
        id: person.exists && person.id ? person.id : `ghost-person-${person.name}-${Date.now()}`,
        label: person.name,
        ghost: !person.exists,
        icon: <User className="h-3 w-3" />,
      });
    });

    // Teams
    aiResult.teams.forEach((team) => {
      smartChips.push({
        id: team.exists && team.id ? team.id : `ghost-team-${team.name}-${Date.now()}`,
        label: team.name,
        ghost: !team.exists,
        icon: <Users className="h-3 w-3" />,
      });
    });

    // Themes
    aiResult.themes.forEach((theme) => {
      // Determine theme type - use AI suggestion or default to 'category'
      const themeType = theme.type || 'category';
      // Use yellow color for theme chips (#FCD34D is a nice yellow)
      const themeColor = '#FCD34D';
      
      smartChips.push({
        id: theme.exists && theme.id ? theme.id : `ghost-theme-${theme.name}-${Date.now()}`,
        label: theme.name,
        ghost: !theme.exists,
        icon: <Tag className="h-3 w-3" />,
        color: themeColor,
        // Store theme type in metadata for later use
        metadata: { themeType },
      });
    });

    // Priority
    if (aiResult.priority) {
      smartChips.push({
        id: `priority-${aiResult.priority}`,
        label: aiResult.priority,
        ghost: false,
        color: aiResult.priority === "urgent" ? "#EB6834" : aiResult.priority === "high" ? "#FF6B6B" : undefined,
        icon: <AlertTriangle className="h-3 w-3" />,
      });
    }

    // Assets
    aiResult.assets.forEach((asset) => {
      smartChips.push({
        id: `ghost-asset-${asset}-${Date.now()}`,
        label: asset,
        ghost: true,
        icon: <Package className="h-3 w-3" />,
      });
    });

    return smartChips;
  }, [aiResult]);

  // Filter available chips based on input
  const filteredChips = inputValue.trim()
    ? availableChips.filter((chip) =>
        chip.label.toLowerCase().includes(inputValue.toLowerCase())
      )
    : [];

  // Combine filtered chips with AI chips (prioritize AI chips)
  const allSuggestedChips = useMemo(() => {
    // Remove duplicates (prefer AI chips over filtered)
    const chipMap = new Map<string, Chip>();
    
    // Add AI chips first
    aiChips.forEach((chip) => {
      chipMap.set(chip.label.toLowerCase(), chip);
    });
    
    // Add filtered chips if not already present
    filteredChips.forEach((chip) => {
      if (!chipMap.has(chip.label.toLowerCase())) {
        chipMap.set(chip.label.toLowerCase(), chip);
      }
    });
    
    return Array.from(chipMap.values());
  }, [aiChips, filteredChips]);

  // Check if input matches any existing chip
  const hasExactMatch = availableChips.some(
    (chip) => chip.label.toLowerCase() === inputValue.toLowerCase().trim()
  );

  // Check if a chip is already in the current list (by label, case-insensitive)
  const isChipInList = useCallback((chipLabel: string) => {
    return chips.some(
      (chip) => chip.label.toLowerCase() === chipLabel.toLowerCase()
    );
  }, [chips]);

  // Check if input matches any chip in the current list
  const isInCurrentList = isChipInList(inputValue.trim());

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();

      // If there's an exact match in available chips, add it
      const exactMatch = availableChips.find(
        (chip) => chip.label.toLowerCase() === inputValue.toLowerCase().trim()
      );

      if (exactMatch && !isInCurrentList) {
        onChipsChange([...chips, exactMatch]);
        setInputValue("");
        return;
      }

      // If no match and not in current list, create ghost chip
      if (!hasExactMatch && !isInCurrentList) {
        const ghostChip: Chip = {
          id: `ghost-${Date.now()}-${Math.random()}`,
          label: inputValue.trim(),
          ghost: true,
        };
        onChipsChange([...chips, ghostChip]);
        onCreateGhost?.(inputValue.trim());
        setInputValue("");
      }
    } else if (e.key === "Backspace" && !inputValue && chips.length > 0) {
      // Remove last chip on backspace when input is empty
      onChipsChange(chips.slice(0, -1));
    } else if (e.key === "Escape") {
      setInputValue("");
      inputRef.current?.blur();
    }
  };

  const handleChipRemove = (chipId: string) => {
    onChipsChange(removeChipById(chipId, chips));
  };

  const handleFilteredChipClick = (chip: Chip) => {
    if (!isChipInList(chip.label)) {
      onChipsChange([...chips, chip]);
      setInputValue("");
      inputRef.current?.focus();
    }
  };


  return (
    <div className={cn("space-y-2", className)}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="relative">
          {/* Input with filtered suggestions */}
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              placeholder={placeholder}
              className={cn(
                "shadow-engraved",
                "focus:ring-2 focus:ring-primary/30"
              )}
            />

            {/* AI Loading indicator */}
            {aiLoading && inputValue.trim() && (
              <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-e3 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>AI analyzing...</span>
                </div>
              </div>
            )}

            {/* AI Suggestions and Filtered suggestions dropdown */}
            {inputValue.trim() && !aiLoading && allSuggestedChips.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-e3 max-h-64 overflow-y-auto">
                {/* AI Chips Section */}
                {aiChips.length > 0 && (
                  <div className="p-2 border-b border-border/30">
                    <div className="flex items-center gap-1.5 mb-2 px-1">
                      <Sparkles className="h-3 w-3 text-[#8EC9CE]" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        AI Suggestions
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {aiChips
                        .filter((chip) => !isChipInList(chip.label))
                        .slice(0, 8)
                        .map((chip) => (
                          <button
                            key={chip.id}
                            type="button"
                            onClick={() => handleFilteredChipClick(chip)}
                            className="inline-block"
                          >
                            <StandardChip
                              label={chip.label}
                              ghost={chip.ghost}
                              color={chip.color}
                              icon={chip.icon}
                              className="cursor-pointer hover:scale-105 transition-transform"
                            />
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Filtered Chips Section */}
                {filteredChips.filter((chip) => !isChipInList(chip.label) && !aiChips.some(ac => ac.label.toLowerCase() === chip.label.toLowerCase())).length > 0 && (
                  <div className="p-2">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 px-1">
                      Available
                    </div>
                    {filteredChips
                      .filter((chip) => !isChipInList(chip.label) && !aiChips.some(ac => ac.label.toLowerCase() === chip.label.toLowerCase()))
                      .slice(0, 5)
                      .map((chip) => (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => handleFilteredChipClick(chip)}
                          className="w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors text-sm rounded"
                        >
                          {chip.label}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Ghost chip preview (when no AI suggestions and no matches) */}
            {inputValue.trim() &&
              !aiLoading &&
              !hasExactMatch &&
              !isInCurrentList &&
              allSuggestedChips.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-e3 p-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Press Enter to create:</span>
                    <StandardChip
                      label={inputValue.trim()}
                      ghost
                      className="flex-shrink-0"
                    />
                  </div>
                </div>
              )}
          </div>

          {/* Chips display */}
          {chips.length > 0 && (
            <div className="mt-3">
              <SortableContext
                items={chips.map((c) => c.id)}
                strategy={rectSortingStrategy}
              >
                <div className="flex flex-wrap gap-2 min-h-[32px] p-2 rounded-lg bg-background/50 border border-border/30">
                  {chips.map((chip) => (
                    <SortableChipItem
                      key={chip.id}
                      chip={chip}
                      isDragging={activeId === chip.id}
                      onRemove={() => handleChipRemove(chip.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </div>
          )}
        </div>
      </DndContext>
    </div>
  );
}

